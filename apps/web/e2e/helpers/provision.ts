/**
 * Deterministic E2E provisioning for the Week-4 offer flows.
 *
 * Rather than scraping the signup OTP email, these helpers create confirmed,
 * onboarded customers via the Supabase Admin API and seed a LIVE listing via SQL,
 * so specs start from a known state and only drive the OFFER journey through the UI.
 *
 * Requires the full local stack (`pnpm supabase:start && pnpm supabase:reset`) and,
 * in the environment:
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

export const DEFAULT_PASSWORD = 'Aa1!aaaa'; // satisfies the §10.5 policy (8+, upper/lower/number/special)

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const sql = postgres(DB_URL, { max: 4, onnotice: () => {}, prepare: false });

const createdUsers: string[] = [];
const createdListings: string[] = [];
let seq = 0;

export interface Customer {
  id: string;
  email: string;
  password: string;
}

/** Create a confirmed, onboarded CUSTOMER (skips the email-code UI). */
export async function createCustomer(tag: string): Promise<Customer> {
  seq += 1;
  const email = `e2e_${tag}_${process.pid}_${seq}@markaz.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: DEFAULT_PASSWORD,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`);
  const id = data.user.id;
  // handle_new_user creates the profile row. Fully complete it so the customer lands
  // on the dashboard (profile complete + identity VERIFIED_DEMO) and offers are allowed:
  // resolvePostAuthDestination requires fullName + terms + privacy + VERIFIED_DEMO.
  await sql`
    update public.profiles set
      full_name = ${`E2E ${tag}`},
      terms_accepted_at = now(),
      privacy_accepted_at = now(),
      identity_verification_status = 'VERIFIED_DEMO',
      onboarding_completed_at = now()
    where id = ${id}`;
  createdUsers.push(id);
  return { id, email, password: DEFAULT_PASSWORD };
}

/**
 * Seed a LIVE, publicly-visible listing owned by `ownerId`; returns its public id + slug.
 * Creates a linked `properties` row + `public_slug` so the listing satisfies the
 * `marketplace_listings` view (state=LIVE, public_id not null, joined property) and its
 * public property page renders.
 */
export async function createLiveListing(
  ownerId: string,
  opts: { askingPrice?: number; minNotificationPrice?: number | null; title?: string } = {},
): Promise<{ id: string; publicId: string; slug: string }> {
  const publicId = `e2e-${(seq += 1)}-${process.pid}`;
  const slug = 'e2e-marina-villa';
  const id = await asServiceListing(ownerId, publicId, slug, opts);
  createdListings.push(id);
  return { id, publicId, slug };
}

async function asServiceListing(
  ownerId: string,
  publicId: string,
  slug: string,
  opts: { askingPrice?: number; minNotificationPrice?: number | null; title?: string },
): Promise<string> {
  const [prop] = await sql`
    insert into public.properties
      (id, owner_id, property_type, emirate, community, building_or_project, bedrooms, bathrooms, size_sqft)
    values
      (gen_random_uuid(), ${ownerId}, 'APARTMENT', 'Dubai', 'Dubai Marina', 'Marina Gate', 2, 2, 1200)
    returning id`;
  const propertyId = (prop as { id: string }).id;
  const [row] = await sql`
    insert into public.listings
      (id, owner_id, property_id, title, state, version, publication_version, asking_price,
       min_notification_price, public_id, public_slug, published_at, public_updated_at)
    values
      (gen_random_uuid(), ${ownerId}, ${propertyId}, ${opts.title ?? 'E2E Marina Villa'}, 'LIVE', 1, 1,
       ${opts.askingPrice ?? 2_000_000}, ${opts.minNotificationPrice ?? null}, ${publicId}, ${slug}, now(), now())
    returning id`;
  return (row as { id: string }).id;
}

// --- Week 5: transaction provisioning (accepted offer → transaction) -----------
async function asRole<T>(userId: string, fn: (tx: typeof sql) => Promise<T>): Promise<T> {
  return sql.begin(async (tx) => {
    await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: userId, role: 'authenticated' })}, true)`;
    await tx`select set_config('role', 'authenticated', true)`;
    return fn(tx as unknown as typeof sql);
  }) as Promise<T>;
}
async function txVersion(txId: string): Promise<number> {
  const r = await sql`select version from public.transactions where id = ${txId}`;
  return (r[0] as { version: number }).version;
}

/** Create an accepted offer for (buyer, seller) on a listing and ensure its transaction. */
export async function acceptedTransaction(buyerId: string, sellerId: string, listingId: string): Promise<string> {
  const threadId = await asRole(buyerId, async (tx) => {
    const [t] = await tx`select id from public.create_offer(${listingId}::uuid, 2000000, null)`;
    return (t as { id: string }).id;
  });
  const meta = await sql`select current_proposal_id, version from public.offer_threads where id = ${threadId}`;
  const m = meta[0] as { current_proposal_id: string; version: number };
  await asRole(sellerId, (tx) => tx`select public.accept_offer(${threadId}::uuid, ${m.current_proposal_id}::uuid, ${m.version})`);
  return asRole(buyerId, async (tx) => {
    const [t] = await tx`select id from public.ensure_transaction(${threadId}::uuid)`;
    return (t as { id: string }).id;
  });
}

async function stepTx(txId: string, userId: string, run: (tx: typeof sql, v: number) => Promise<unknown>): Promise<void> {
  const v = await txVersion(txId);
  await asRole(userId, (tx) => run(tx, v));
}

/** Drive to the DEPOSIT stage (both details confirmed + cash route). */
export async function driveToDeposit(txId: string, buyerId: string, sellerId: string): Promise<void> {
  await stepTx(txId, buyerId, (tx, v) => tx`select public.tx_complete_task(${txId}::uuid, 'BUYER_CONFIRM_DETAILS', ${v})`);
  await stepTx(txId, sellerId, (tx, v) => tx`select public.tx_complete_task(${txId}::uuid, 'SELLER_CONFIRM_DETAILS', ${v})`);
  await stepTx(txId, buyerId, (tx, v) => tx`select public.tx_select_route(${txId}::uuid, 'CASH', ${v})`);
}

/** Drive to the DOCUMENTS stage (deposit confirmed). */
export async function driveToDocuments(txId: string, buyerId: string, sellerId: string): Promise<void> {
  await driveToDeposit(txId, buyerId, sellerId);
  await stepTx(txId, buyerId, (tx, v) => tx`select public.tx_confirm_deposit(${txId}::uuid, ${v})`);
}

/** Drive a transaction (via the SQL engine) to the COMPLETION stage, leaving both
 * completion confirmations for the UI to perform. */
export async function driveToCompletion(txId: string, buyerId: string, sellerId: string): Promise<void> {
  const step = (userId: string, run: (tx: typeof sql, v: number) => Promise<unknown>) => stepTx(txId, userId, run);
  await step(buyerId, (tx, v) => tx`select public.tx_complete_task(${txId}::uuid, 'BUYER_CONFIRM_DETAILS', ${v})`);
  await step(sellerId, (tx, v) => tx`select public.tx_complete_task(${txId}::uuid, 'SELLER_CONFIRM_DETAILS', ${v})`);
  await step(buyerId, (tx, v) => tx`select public.tx_select_route(${txId}::uuid, 'CASH', ${v})`);
  await step(buyerId, (tx, v) => tx`select public.tx_confirm_deposit(${txId}::uuid, ${v})`);
  await asRole(buyerId, (tx) => tx`select id from public.tx_register_document(${txId}::uuid, 'BUYER_IDENTITY', ${`${txId}/${buyerId}/id.pdf`}, 'id.pdf', 'application/pdf', 1000)`);
  await asRole(sellerId, (tx) => tx`select id from public.tx_register_document(${txId}::uuid, 'SELLER_IDENTITY', ${`${txId}/${sellerId}/id.pdf`}, 'id.pdf', 'application/pdf', 1000)`);
  await step(buyerId, (tx, v) => tx`select public.tx_complete_task(${txId}::uuid, 'BUYER_DOCUMENTS', ${v})`);
  await step(sellerId, (tx, v) => tx`select public.tx_complete_task(${txId}::uuid, 'SELLER_DOCUMENTS', ${v})`);
  await step(buyerId, (tx, v) => tx`select public.tx_complete_task(${txId}::uuid, 'BUYER_REVIEW_SUMMARY', ${v})`);
  await step(sellerId, (tx, v) => tx`select public.tx_complete_task(${txId}::uuid, 'SELLER_REVIEW_SUMMARY', ${v})`);
  await step(buyerId, (tx, v) => tx`select public.tx_run_due_diligence(${txId}::uuid, ${v})`);
  await step(sellerId, (tx, v) => tx`select public.tx_propose_transfer_date(${txId}::uuid, (current_date + 10), ${v})`);
  await step(buyerId, (tx, v) => tx`select public.tx_complete_task(${txId}::uuid, 'BUYER_CONFIRM_READINESS', ${v})`);
  await step(sellerId, (tx, v) => tx`select public.tx_complete_task(${txId}::uuid, 'SELLER_CONFIRM_READINESS', ${v})`);
  await step(buyerId, (tx, v) => tx`select public.tx_create_appointment(${txId}::uuid, ${v})`);
}

/**
 * Best-effort teardown of everything provisioned in the run. Does NOT end the shared
 * postgres pool — Playwright may reuse one worker across spec files, so ending the pool
 * here would break a later file. The worker process exit closes the sockets.
 */
export async function teardown(): Promise<void> {
  try {
    if (createdListings.length) await sql`delete from public.listings where id in ${sql(createdListings)}`;
    for (const id of createdUsers) await admin.auth.admin.deleteUser(id).catch(() => {});
  } finally {
    createdListings.length = 0;
    createdUsers.length = 0;
  }
}
