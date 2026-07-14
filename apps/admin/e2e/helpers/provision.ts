/**
 * Deterministic E2E provisioning for the Week-6 admin flows.
 *
 * Creates a confirmed ADMIN and confirmed CUSTOMERs via the Supabase Admin API, and
 * seeds listings / publication requests / offer threads via SQL + the canonical
 * SECURITY DEFINER functions — so admin specs start from a known state and drive only
 * the OPERATIONS journey through the portal UI.
 *
 * Requires the full local stack and, in the environment:
 *   - SUPABASE_URL                (default http://127.0.0.1:54321)
 *   - SUPABASE_SERVICE_ROLE_KEY   (local `sb_secret_...` / service-role key)
 *   - TEST_DATABASE_URL           (default postgresql://postgres:postgres@127.0.0.1:54322/postgres)
 *
 * SAFETY: refuses any non-loopback database host — never runs against a remote DB.
 */
import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const DB_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

function assertLoopback(url: string): void {
  const host = new URL(url).hostname;
  if (!['127.0.0.1', 'localhost', '::1'].includes(host)) {
    throw new Error(`Refusing to provision E2E data against non-loopback DB host "${host}".`);
  }
}
assertLoopback(DB_URL);

export const DEFAULT_PASSWORD = 'Aa1!aaaa';

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const sql = postgres(DB_URL, { max: 4, onnotice: () => {}, prepare: false });

const createdUsers: string[] = [];
const createdListings: string[] = [];
let seq = 0;

/** First row or throw — keeps provisioning honest under strict index checks. */
function one<T>(rows: readonly T[], what: string): T {
  const row = rows[0];
  if (!row) throw new Error(`provision: expected a row for ${what}`);
  return row;
}

export interface Principal {
  id: string;
  email: string;
  password: string;
}

async function createConfirmedUser(tag: string): Promise<string> {
  seq += 1;
  const email = `e2e_admin_${tag}_${process.pid}_${seq}@markaz.test`;
  const { data, error } = await admin.auth.admin.createUser({ email, password: DEFAULT_PASSWORD, email_confirm: true });
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`);
  createdUsers.push(data.user.id);
  return data.user.id;
}

/** Create a confirmed ADMIN. account_type is set via the elevated postgres connection
 * (the guard blocks authenticated/anon self-promotion, never the service path). */
export async function createAdmin(tag = 'ops'): Promise<Principal> {
  const id = await createConfirmedUser(tag);
  const email = `e2e_admin_${tag}_${process.pid}_${seq}@markaz.test`;
  await sql`
    update public.profiles set
      full_name = ${`E2E Admin ${tag}`},
      account_type = 'ADMIN',
      terms_accepted_at = now(),
      privacy_accepted_at = now(),
      onboarding_completed_at = now()
    where id = ${id}`;
  return { id, email, password: DEFAULT_PASSWORD };
}

/** Create a confirmed, fully-onboarded CUSTOMER. */
export async function createCustomer(tag: string): Promise<Principal> {
  const id = await createConfirmedUser(tag);
  const email = `e2e_admin_${tag}_${process.pid}_${seq}@markaz.test`;
  await sql`
    update public.profiles set
      full_name = ${`E2E ${tag}`},
      terms_accepted_at = now(),
      privacy_accepted_at = now(),
      identity_verification_status = 'VERIFIED_DEMO',
      onboarding_completed_at = now()
    where id = ${id}`;
  return { id, email, password: DEFAULT_PASSWORD };
}

interface SeededListing { id: string; publicId: string; title: string }

/** Seed a LIVE, publicly-visible listing owned by `ownerId`. */
export async function createLiveListing(ownerId: string, title = 'E2E Marina Apartment'): Promise<SeededListing> {
  const row = one(await sql<{ id: string; public_id: string }[]>`
    with prop as (
      insert into public.properties (owner_id, property_type, community, emirate, building_or_project, bedrooms, bathrooms, unit_identifier, occupancy_status)
      values (${ownerId}, 'APARTMENT', 'Dubai Marina', 'DUBAI', 'Marina Heights', 2, 2, 'Unit 1204', 'VACANT')
      returning id
    ),
    lst as (
      insert into public.listings (owner_id, property_id, title, state, asking_price, public_id, public_slug)
      select ${ownerId}, prop.id, ${title}, 'LIVE', 1500000, 'MKZ-' || substr(md5(random()::text), 1, 8), 'e2e-marina'
      from prop
      returning id, public_id
    )
    select id, public_id from lst`, 'live listing');
  createdListings.push(row.id);
  return { id: row.id, publicId: row.public_id, title };
}

/** Seed a READY_TO_PUBLISH listing with a PENDING publication request (for the review queue). */
export async function createPendingPublication(ownerId: string, title = 'E2E JBR Loft'): Promise<{ listingId: string; requestId: string }> {
  const listingId = one(await sql<{ id: string }[]>`
    with prop as (
      insert into public.properties (owner_id, property_type, community, emirate, building_or_project, bedrooms, bathrooms, unit_identifier, occupancy_status)
      values (${ownerId}, 'APARTMENT', 'JBR', 'DUBAI', 'Sadaf 3', 1, 1, 'Unit 302', 'VACANT')
      returning id
    )
    insert into public.listings (owner_id, property_id, title, state, asking_price, public_id, public_slug)
    select ${ownerId}, prop.id, ${title}, 'READY_TO_PUBLISH', 900000, 'MKZ-' || substr(md5(random()::text), 1, 8), 'e2e-jbr'
    from prop
    returning id`, 'ready listing').id;
  createdListings.push(listingId);
  const requestId = one(await sql<{ id: string }[]>`
    insert into public.listing_publication_requests (listing_id, seller_user_id, status, submitted_at)
    values (${listingId}, ${ownerId}, 'PENDING', now())
    returning id`, 'publication request').id;
  return { listingId, requestId };
}

/** A buyer opens an offer thread on a listing (via the canonical create_offer function).
 * Runs in a transaction that sets the buyer's RLS context (as the integration `asUser` helper). */
export async function createOfferThread(buyerId: string, listingId: string, amount = 1400000): Promise<string> {
  const claims = JSON.stringify({ sub: buyerId, role: 'authenticated', account_type: 'CUSTOMER' });
  const rows = (await sql.begin(async (tx) => {
    await tx`select set_config('request.jwt.claims', ${claims}, true)`;
    await tx`select set_config('role', 'authenticated', true)`;
    // create_offer returns the whole offer_threads row — extract its id.
    return tx`select (public.create_offer(${listingId}::uuid, ${amount}::numeric, null::timestamptz)).id as thread_id`;
  })) as unknown as { thread_id: string }[];
  return one(rows, 'offer thread').thread_id;
}

/** Run a query as a given customer's RLS context (mirrors the integration `asUser` helper). */
async function asRole<T>(userId: string, fn: (tx: typeof sql) => Promise<T>): Promise<T> {
  const claims = JSON.stringify({ sub: userId, role: 'authenticated', account_type: 'CUSTOMER' });
  return (await sql.begin(async (tx) => {
    await tx`select set_config('request.jwt.claims', ${claims}, true)`;
    await tx`select set_config('role', 'authenticated', true)`;
    return fn(tx as unknown as typeof sql);
  })) as T;
}

/** Accept an offer for (buyer, seller) on a listing and ensure its transaction. Returns the tx id. */
export async function acceptedTransaction(buyerId: string, sellerId: string, listingId: string): Promise<string> {
  const threadId = await asRole(buyerId, async (tx) => {
    const r = await tx`select id from public.create_offer(${listingId}::uuid, 2000000, null::timestamptz)`;
    return (r[0] as { id: string }).id;
  });
  const meta = await sql`select current_proposal_id, version from public.offer_threads where id = ${threadId}`;
  const m = meta[0] as { current_proposal_id: string; version: number };
  await asRole(sellerId, (tx) => tx`select public.accept_offer(${threadId}::uuid, ${m.current_proposal_id}::uuid, ${m.version})`);
  return asRole(buyerId, async (tx) => {
    const r = await tx`select id from public.ensure_transaction(${threadId}::uuid)`;
    return (r[0] as { id: string }).id;
  });
}

/** Upload a real (fictional) object to the private transaction-documents bucket and register
 * a metadata row. Returns the transaction_documents id — the target of the admin access flow. */
export async function provisionTransactionDocument(txId: string, uploaderId: string): Promise<string> {
  seq += 1;
  const path = `${txId}/${uploaderId}/id-${seq}.pdf`;
  const { error } = await admin.storage
    .from('transaction-documents')
    .upload(path, Buffer.from('%PDF-1.4\n% e2e fictional document\n'), { contentType: 'application/pdf', upsert: true });
  if (error) throw new Error(`doc upload failed: ${error.message}`);
  const row = one(await sql<{ id: string }[]>`
    insert into public.transaction_documents (transaction_id, uploaded_by, document_type, storage_path, file_name, mime_type, size_bytes, status)
    values (${txId}, ${uploaderId}, 'BUYER_IDENTITY', ${path}, 'id.pdf', 'application/pdf', 30, 'UPLOADED')
    returning id`, 'transaction document');
  return row.id;
}

export async function teardown(): Promise<void> {
  for (const id of createdListings) await sql`delete from public.listings where id = ${id}`.catch(() => {});
  for (const id of createdUsers) await admin.auth.admin.deleteUser(id).catch(() => {});
  await sql.end({ timeout: 5 });
}
