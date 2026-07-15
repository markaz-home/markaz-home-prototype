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
const DB_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

function assertLoopback(url: string): void {
  const host = new URL(url).hostname;
  if (!['127.0.0.1', 'localhost', '::1'].includes(host)) {
    throw new Error(`Refusing to provision E2E data against non-loopback DB host "${host}".`);
  }
}
assertLoopback(DB_URL);

export const DEFAULT_PASSWORD = 'Aa1!aaaa'; // satisfies the §10.5 policy (8+, upper/lower/number/special)

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const sql = postgres(DB_URL, { max: 4, onnotice: () => {}, prepare: false });

const createdUsers: string[] = [];
const createdListings: string[] = [];
let seq = 0;

/** 1x1 transparent PNG — a valid image object for the public/draft photo buckets. */
const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
const PUBLIC_BUCKET = 'listing-photos';
const DRAFT_BUCKET = 'listing-photos-draft';

export interface Customer {
  id: string;
  email: string;
  password: string;
}

/** Any listing lifecycle state a spec may need to provision directly. */
export type ProvisionListingState =
  | 'DRAFT'
  | 'OWNERSHIP_REVIEW'
  | 'READY_TO_PUBLISH'
  | 'LIVE'
  | 'PAUSED';

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

interface ListingOpts {
  state: ProvisionListingState;
  askingPrice?: number;
  minNotificationPrice?: number | null;
  title?: string;
  /** Property description; long enough (>= 80 chars) to satisfy details validation. */
  description?: string;
}

/**
 * Seed a listing in any lifecycle state, owned by `ownerId`. Always creates a linked
 * `properties` row with FULL details (so `isDetailsComplete` passes and the wizard steps
 * render). LIVE/PAUSED listings get a `public_id`/`public_slug`/`published_at` (so LIVE ones
 * satisfy the `marketplace_listings` view); DRAFT/OWNERSHIP_REVIEW/READY_TO_PUBLISH get none.
 */
export async function createListing(
  ownerId: string,
  opts: ListingOpts,
): Promise<{ id: string; publicId: string | null; slug: string | null }> {
  const published = opts.state === 'LIVE' || opts.state === 'PAUSED';
  const publicId = published ? `e2e-${(seq += 1)}-${process.pid}` : null;
  const slug = published ? 'e2e-marina-villa' : null;
  const description =
    opts.description ??
    'A bright two-bedroom apartment in Dubai Marina with an open living area, a fitted kitchen, and a balcony overlooking the water. Provisioned for the E2E test suite.';
  const [prop] = await sql`
    insert into public.properties
      (id, owner_id, property_type, emirate, community, building_or_project, unit_identifier,
       bedrooms, bathrooms, size_sqft, furnishing_status, occupancy_status, completion_status)
    values
      (gen_random_uuid(), ${ownerId}, 'APARTMENT', 'Dubai', 'Dubai Marina', 'Marina Gate', 'Unit 101',
       2, 2, 1200, 'FURNISHED', 'VACANT', 'READY')
    returning id`;
  const propertyId = (prop as { id: string }).id;
  const [row] = await sql`
    insert into public.listings
      (id, owner_id, property_id, title, description, state, version, publication_version, asking_price,
       min_notification_price, public_id, public_slug, published_at, public_updated_at)
    values
      (gen_random_uuid(), ${ownerId}, ${propertyId}, ${opts.title ?? 'E2E Marina Villa'}, ${description},
       ${opts.state}, 1, 1, ${opts.askingPrice ?? 2_000_000}, ${opts.minNotificationPrice ?? null},
       ${publicId}, ${slug}, ${published ? sql`now()` : null}, ${published ? sql`now()` : null})
    returning id`;
  const id = (row as { id: string }).id;
  createdListings.push(id);
  return { id, publicId, slug };
}

/**
 * Seed a LIVE, publicly-visible listing owned by `ownerId`; returns its public id + slug.
 * Thin wrapper over `createListing` for the offers/transactions specs' existing call sites.
 */
export async function createLiveListing(
  ownerId: string,
  opts: { askingPrice?: number; minNotificationPrice?: number | null; title?: string } = {},
): Promise<{ id: string; publicId: string; slug: string }> {
  const l = await createListing(ownerId, { ...opts, state: 'LIVE' });
  return { id: l.id, publicId: l.publicId!, slug: l.slug! };
}

/**
 * Insert `count` `property_photos` rows for a listing (first is the cover; sort_order 0..n).
 * When `publicId` is provided, also set the deterministic `public_path` and upload a 1x1 PNG
 * to the PUBLIC `listing-photos` bucket at that key — so a published listing's gallery renders
 * and its photo count is correct. Returns the created photo ids.
 */
export async function addPhotos(
  listingId: string,
  publicId: string | null,
  count: number,
): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const [row] = await sql`
      insert into public.property_photos
        (id, listing_id, storage_path, is_cover, sort_order, content_type)
      values
        (gen_random_uuid(), ${listingId}, ${`${listingId}/photo-${i}.png`}, ${i === 0}, ${i}, 'image/png')
      returning id`;
    const photoId = (row as { id: string }).id;
    ids.push(photoId);
    if (publicId) {
      const key = `${publicId}/${photoId}`;
      // public_path is trigger-guarded against authenticated/anon; the raw `postgres`
      // connection is permitted (mirrors the elevated publication pipeline).
      await sql`update public.property_photos set public_path = ${key} where id = ${photoId}`;
      await admin.storage
        .from(PUBLIC_BUCKET)
        .upload(key, PNG_1x1, { contentType: 'image/png', upsert: true });
    }
  }
  return ids;
}

/** Insert a (visible-by-default) investment case so the detail page shows "Estimated ROI". */
export async function addInvestmentCase(
  listingId: string,
  opts: { visible?: boolean; estimatedRoiPct?: number } = {},
): Promise<void> {
  await sql`
    insert into public.investment_cases
      (id, listing_id, original_purchase_price, visible, estimated_roi_pct)
    values
      (gen_random_uuid(), ${listingId}, 1500000, ${opts.visible ?? true}, ${opts.estimatedRoiPct ?? 12.5})`;
}

/** Save a listing for a customer (bypasses RLS; used to seed the saved-properties list). */
export async function saveListing(customerId: string, listingId: string): Promise<void> {
  await sql`
    insert into public.saved_properties (id, customer_id, listing_id)
    values (gen_random_uuid(), ${customerId}, ${listingId})
    on conflict do nothing`;
}

/**
 * Attach the records a READY_TO_PUBLISH listing needs to be publication-eligible AND to
 * survive the §4.4 resolve gate: an active ownership document, a VERIFIED_DEMO ownership
 * verification, a VERIFIED_DEMO Form A, a VERIFIED_DEMO permit, and `photos` draft photos
 * whose objects actually exist in the private draft bucket (so the publish→LIVE copy works).
 */
export async function makePublishable(
  listingId: string,
  ownerId: string,
  opts: { photos?: number } = {},
): Promise<string[]> {
  const photos = opts.photos ?? 1;
  await sql`
    insert into public.ownership_documents
      (id, listing_id, owner_id, document_type, storage_path, status, active)
    values
      (gen_random_uuid(), ${listingId}, ${ownerId}, 'TITLE_DEED', ${`${listingId}/deed.pdf`}, 'VERIFIED_DEMO', true)`;
  await sql`
    insert into public.verifications (id, listing_id, kind, status)
    values (gen_random_uuid(), ${listingId}, 'OWNERSHIP', 'VERIFIED_DEMO')`;
  await sql`
    insert into public.form_a_records (id, listing_id, status)
    values (gen_random_uuid(), ${listingId}, 'VERIFIED_DEMO')`;
  await sql`
    insert into public.permit_records (id, listing_id, permit_type, status)
    values (gen_random_uuid(), ${listingId}, 'TRAKHEESI', 'VERIFIED_DEMO')`;
  const ids: string[] = [];
  for (let i = 0; i < photos; i++) {
    const path = `${listingId}/draft-${i}.png`;
    const [row] = await sql`
      insert into public.property_photos
        (id, listing_id, storage_path, is_cover, sort_order, content_type)
      values
        (gen_random_uuid(), ${listingId}, ${path}, ${i === 0}, ${i}, 'image/png')
      returning id`;
    ids.push((row as { id: string }).id);
    await admin.storage
      .from(DRAFT_BUCKET)
      .upload(path, PNG_1x1, { contentType: 'image/png', upsert: true });
  }
  return ids;
}

/** Create a READY_TO_PUBLISH listing that is fully publishable (records + real draft photos). */
export async function createPublishableListing(
  ownerId: string,
  opts: { photos?: number; title?: string } = {},
): Promise<{ id: string }> {
  const l = await createListing(ownerId, {
    state: 'READY_TO_PUBLISH',
    title: opts.title,
    askingPrice: 2_100_000,
    minNotificationPrice: 1_950_000,
  });
  await makePublishable(l.id, ownerId, { photos: opts.photos ?? 2 });
  return { id: l.id };
}

/**
 * Insert a resolved (REJECTED_DEMO) publication request so the publication-status UI renders
 * the returned-for-changes or photo-processing-failure screen. `outcomeCategory` is
 * `'DEMO_REVIEW_RETURNED'` or `'PHOTO_PROCESSING_FAILED'`. Not superseded → it is the current
 * request; a retry supersedes it and creates a fresh PENDING.
 */
export async function createPublicationRequest(
  listingId: string,
  sellerId: string,
  outcomeCategory: 'DEMO_REVIEW_RETURNED' | 'PHOTO_PROCESSING_FAILED',
): Promise<void> {
  await sql`
    insert into public.listing_publication_requests
      (id, listing_id, seller_user_id, status, outcome_category, submitted_at, resolved_at, superseded_at)
    values
      (gen_random_uuid(), ${listingId}, ${sellerId}, 'REJECTED_DEMO', ${outcomeCategory}, now(), now(), null)`;
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
export async function acceptedTransaction(
  buyerId: string,
  sellerId: string,
  listingId: string,
): Promise<string> {
  const threadId = await asRole(buyerId, async (tx) => {
    const [t] = await tx`select id from public.create_offer(${listingId}::uuid, 2000000, null)`;
    return (t as { id: string }).id;
  });
  const meta =
    await sql`select current_proposal_id, version from public.offer_threads where id = ${threadId}`;
  const m = meta[0] as { current_proposal_id: string; version: number };
  await asRole(
    sellerId,
    (tx) =>
      tx`select public.accept_offer(${threadId}::uuid, ${m.current_proposal_id}::uuid, ${m.version})`,
  );
  return asRole(buyerId, async (tx) => {
    const [t] = await tx`select id from public.ensure_transaction(${threadId}::uuid)`;
    return (t as { id: string }).id;
  });
}

async function stepTx(
  txId: string,
  userId: string,
  run: (tx: typeof sql, v: number) => Promise<unknown>,
): Promise<void> {
  const v = await txVersion(txId);
  await asRole(userId, (tx) => run(tx, v));
}

/** Drive to the DEPOSIT stage (both details confirmed + cash route). */
export async function driveToDeposit(
  txId: string,
  buyerId: string,
  sellerId: string,
): Promise<void> {
  await stepTx(
    txId,
    buyerId,
    (tx, v) => tx`select public.tx_complete_task(${txId}::uuid, 'BUYER_CONFIRM_DETAILS', ${v})`,
  );
  await stepTx(
    txId,
    sellerId,
    (tx, v) => tx`select public.tx_complete_task(${txId}::uuid, 'SELLER_CONFIRM_DETAILS', ${v})`,
  );
  await stepTx(
    txId,
    buyerId,
    (tx, v) => tx`select public.tx_select_route(${txId}::uuid, 'CASH', ${v})`,
  );
}

/** Drive to the DOCUMENTS stage (deposit confirmed). */
export async function driveToDocuments(
  txId: string,
  buyerId: string,
  sellerId: string,
): Promise<void> {
  await driveToDeposit(txId, buyerId, sellerId);
  await stepTx(txId, buyerId, (tx, v) => tx`select public.tx_confirm_deposit(${txId}::uuid, ${v})`);
}

/** Drive a transaction (via the SQL engine) to the COMPLETION stage, leaving both
 * completion confirmations for the UI to perform. */
export async function driveToCompletion(
  txId: string,
  buyerId: string,
  sellerId: string,
): Promise<void> {
  const step = (userId: string, run: (tx: typeof sql, v: number) => Promise<unknown>) =>
    stepTx(txId, userId, run);
  await step(
    buyerId,
    (tx, v) => tx`select public.tx_complete_task(${txId}::uuid, 'BUYER_CONFIRM_DETAILS', ${v})`,
  );
  await step(
    sellerId,
    (tx, v) => tx`select public.tx_complete_task(${txId}::uuid, 'SELLER_CONFIRM_DETAILS', ${v})`,
  );
  await step(buyerId, (tx, v) => tx`select public.tx_select_route(${txId}::uuid, 'CASH', ${v})`);
  await step(buyerId, (tx, v) => tx`select public.tx_confirm_deposit(${txId}::uuid, ${v})`);
  await asRole(
    buyerId,
    (tx) =>
      tx`select id from public.tx_register_document(${txId}::uuid, 'BUYER_IDENTITY', ${`${txId}/${buyerId}/id.pdf`}, 'id.pdf', 'application/pdf', 1000)`,
  );
  await asRole(
    sellerId,
    (tx) =>
      tx`select id from public.tx_register_document(${txId}::uuid, 'SELLER_IDENTITY', ${`${txId}/${sellerId}/id.pdf`}, 'id.pdf', 'application/pdf', 1000)`,
  );
  await step(
    buyerId,
    (tx, v) => tx`select public.tx_complete_task(${txId}::uuid, 'BUYER_DOCUMENTS', ${v})`,
  );
  await step(
    sellerId,
    (tx, v) => tx`select public.tx_complete_task(${txId}::uuid, 'SELLER_DOCUMENTS', ${v})`,
  );
  await step(
    buyerId,
    (tx, v) => tx`select public.tx_complete_task(${txId}::uuid, 'BUYER_REVIEW_SUMMARY', ${v})`,
  );
  await step(
    sellerId,
    (tx, v) => tx`select public.tx_complete_task(${txId}::uuid, 'SELLER_REVIEW_SUMMARY', ${v})`,
  );
  await step(buyerId, (tx, v) => tx`select public.tx_run_due_diligence(${txId}::uuid, ${v})`);
  await step(
    sellerId,
    (tx, v) => tx`select public.tx_propose_transfer_date(${txId}::uuid, (current_date + 10), ${v})`,
  );
  await step(
    buyerId,
    (tx, v) => tx`select public.tx_complete_task(${txId}::uuid, 'BUYER_CONFIRM_READINESS', ${v})`,
  );
  await step(
    sellerId,
    (tx, v) => tx`select public.tx_complete_task(${txId}::uuid, 'SELLER_CONFIRM_READINESS', ${v})`,
  );
  await step(buyerId, (tx, v) => tx`select public.tx_create_appointment(${txId}::uuid, ${v})`);
}

/**
 * Best-effort teardown of everything provisioned in the run. Does NOT end the shared
 * postgres pool — Playwright may reuse one worker across spec files, so ending the pool
 * here would break a later file. The worker process exit closes the sockets.
 */
export async function teardown(): Promise<void> {
  try {
    if (createdListings.length)
      await sql`delete from public.listings where id in ${sql(createdListings)}`;
    for (const id of createdUsers) await admin.auth.admin.deleteUser(id).catch(() => {});
  } finally {
    createdListings.length = 0;
    createdUsers.length = 0;
  }
}
