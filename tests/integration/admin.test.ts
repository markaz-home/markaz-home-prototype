/**
 * Week-6 Admin Portal — integration tests against the live local Postgres.
 * Verifies the ADMIN security boundary, restriction enforcement, controlled admin
 * functions, immutability, and audit — all through the real RLS + SECURITY DEFINER layer.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  asAdmin,
  asAnon,
  asService,
  asUser,
  cleanup,
  closePool,
  createAdmin,
  createLiveListing,
  createPrincipal,
  dbReachable,
  expectError,
  type Sql,
} from './helpers/db';
import { acceptedThread, callTx } from './helpers/tx';

const reachable = await dbReachable();
const d = reachable ? describe : describe.skip;
if (!reachable) console.warn('[integration] local Postgres not reachable — skipping admin suite');

async function auditCount(action: string, entityId: string): Promise<number> {
  const r = await asService((tx: Sql) => tx`select count(*)::int as n from public.audit_events where action = ${action} and entity_id = ${entityId}`);
  return (r[0] as { n: number }).n;
}
async function createOffer(buyer: string, listing: string, amount = 900_000): Promise<string> {
  return asUser(buyer, async (tx) => {
    const [t] = await tx`select * from public.create_offer(${listing}::uuid, ${amount}, null)`;
    return (t as { id: string }).id;
  });
}

d('admin access & notes (live DB)', () => {
  let admin: string;
  let seller: string;
  let buyer: string;
  beforeAll(async () => {
    admin = await createAdmin('adm');
    seller = await createPrincipal('adm_seller');
    buyer = await createPrincipal('adm_buyer');
  });
  afterAll(async () => {
    await cleanup();
  });

  it('lets an admin read customer profiles + audit; denies anon', async () => {
    const admView = await asAdmin(admin, (tx) => tx`select id from public.profiles where id = ${buyer}`);
    expect(admView.length).toBe(1);
    const anonView = await asAnon((tx) => tx`select id from public.profiles where id = ${buyer}`).catch(() => []);
    expect(anonView.length).toBe(0);
  });

  it('admin can add a note; the customer cannot read admin notes; customer cannot add notes', async () => {
    const listing = await createLiveListing(seller);
    const note = await asAdmin(admin, (tx) => tx`select id from public.admin_add_note('listing', ${listing}::uuid, 'REVIEW', 'Checked the listing details.', null, null)`);
    expect((note[0] as { id: string }).id).toBeTruthy();
    expect(await auditCount('ADMIN_NOTE_ADDED', listing)).toBe(1);
    // Customer (seller) cannot read admin notes at all.
    const sellerView = await asUser(seller, (tx) => tx`select id from public.admin_notes where entity_id = ${listing}`);
    expect(sellerView.length).toBe(0);
    // Customer cannot invoke the admin function.
    await expectError(() => asUser(seller, (tx) => tx`select id from public.admin_add_note('listing', ${listing}::uuid, 'REVIEW', 'nope', null, null)`), /FORBIDDEN|permission denied/i);
  });

  it('rejects a too-short admin note', async () => {
    const listing = await createLiveListing(seller);
    await expectError(() => asAdmin(admin, (tx) => tx`select id from public.admin_add_note('listing', ${listing}::uuid, 'REVIEW', 'x', null, null)`), /INVALID_BODY|check|violat/i);
  });
});

d('customer restriction (live DB)', () => {
  let admin: string;
  let seller: string;
  let buyer: string;
  let listing: string;
  beforeAll(async () => {
    admin = await createAdmin('r_adm');
    seller = await createPrincipal('r_seller');
    buyer = await createPrincipal('r_buyer');
    listing = await createLiveListing(seller);
  });
  afterAll(async () => {
    await cleanup();
  });

  it('restricts a customer (audit written), blocks new offers, then restores', async () => {
    // Before restriction the buyer can make an offer.
    const t1 = await createOffer(buyer, listing);
    expect(t1).toBeTruthy();

    await asAdmin(admin, (tx) => tx`select id from public.admin_restrict_customer(${buyer}::uuid, 'ACCOUNT_REVIEW')`);
    const p = await asService((tx: Sql) => tx`select restricted_at from public.profiles where id = ${buyer}`);
    expect((p[0] as { restricted_at: unknown }).restricted_at).toBeTruthy();
    expect(await auditCount('ADMIN_CUSTOMER_ACTIONS_RESTRICTED', buyer)).toBe(1);

    // A restricted customer cannot make a new offer (DB-enforced).
    const l2 = await createLiveListing(seller);
    await expectError(() => createOffer(buyer, l2), /ACCOUNT_RESTRICTED/);

    // Re-restricting is rejected.
    await expectError(() => asAdmin(admin, (tx) => tx`select id from public.admin_restrict_customer(${buyer}::uuid, 'ACCOUNT_REVIEW')`), /ALREADY_RESTRICTED/);

    // Restore lifts the restriction.
    await asAdmin(admin, (tx) => tx`select id from public.admin_restore_customer(${buyer}::uuid, 'ISSUE_RESOLVED')`);
    expect(await auditCount('ADMIN_CUSTOMER_ACTIONS_RESTORED', buyer)).toBe(1);
    const t3 = await createOffer(buyer, l2);
    expect(t3).toBeTruthy();
  });

  it('a customer cannot restrict anyone or set restricted_at directly', async () => {
    await expectError(() => asUser(buyer, (tx) => tx`select id from public.admin_restrict_customer(${seller}::uuid, 'ACCOUNT_REVIEW')`), /FORBIDDEN|permission denied/i);
    await expectError(() => asUser(buyer, (tx) => tx`update public.profiles set restricted_at = now() where id = ${buyer}`), /MARKAZ Operations|permission denied|only by/i);
  });
});

d('admin listing / offer / transaction controls (live DB)', () => {
  let admin: string;
  let seller: string;
  let buyer: string;
  beforeAll(async () => {
    admin = await createAdmin('c_adm');
    seller = await createPrincipal('c_seller');
    buyer = await createPrincipal('c_buyer');
  });
  afterAll(async () => {
    await cleanup();
    await closePool();
  });

  it('admin pauses and resumes a LIVE listing', async () => {
    const listing = await createLiveListing(seller);
    await asAdmin(admin, (tx) => tx`select id from public.admin_pause_listing(${listing}::uuid, 'INFORMATION_UNDER_REVIEW')`);
    let s = await asService((tx: Sql) => tx`select state from public.listings where id = ${listing}`);
    expect((s[0] as { state: string }).state).toBe('PAUSED');
    expect(await auditCount('ADMIN_LISTING_PAUSED', listing)).toBe(1);
    await asAdmin(admin, (tx) => tx`select id from public.admin_resume_listing(${listing}::uuid, 'ISSUE_RESOLVED')`);
    s = await asService((tx: Sql) => tx`select state from public.listings where id = ${listing}`);
    expect((s[0] as { state: string }).state).toBe('LIVE');
    // Pausing a non-LIVE listing is rejected.
    const draft = await createDraft(seller);
    await expectError(() => asAdmin(admin, (tx) => tx`select id from public.admin_pause_listing(${draft}::uuid, 'OPERATIONAL_SAFETY')`), /NOT_LIVE/);
  });

  it('admin closes an invalid offer thread without mutating proposals', async () => {
    const listing = await createLiveListing(seller);
    const thread = await createOffer(buyer, listing);
    const before = await asService((tx: Sql) => tx`select amount_aed::int as a from public.offer_proposals where thread_id = ${thread} order by created_at limit 1`);
    await asAdmin(admin, (tx) => tx`select id from public.admin_close_offer_thread(${thread}::uuid, 'OPERATIONAL_DATA_REPAIR')`);
    const st = await asService((tx: Sql) => tx`select status from public.offer_threads where id = ${thread}`);
    expect((st[0] as { status: string }).status).toBe('CLOSED_LISTING_UNAVAILABLE');
    expect(await auditCount('ADMIN_OFFER_THREAD_CLOSED', thread)).toBe(1);
    // The original proposal amount is unchanged (immutable history).
    const after = await asService((tx: Sql) => tx`select amount_aed::int as a from public.offer_proposals where thread_id = ${thread} order by created_at limit 1`);
    expect((after[0] as { a: number }).a).toBe((before[0] as { a: number }).a);
  });

  it('admin cannot mutate an immutable proposal amount or transaction accepted amount', async () => {
    const listing = await createLiveListing(seller);
    const thread = await acceptedThread(buyer, seller, listing);
    const tx = await callTx(buyer, (t) => t`select * from public.ensure_transaction(${thread}::uuid)`);
    await expectError(() => asAdmin(admin, (t) => t`update public.offer_proposals set amount_aed = 1 where thread_id = ${thread}`), /immutable|permission denied/i);
    await expectError(() => asAdmin(admin, (t) => t`update public.transactions set accepted_amount_aed = 1 where id = ${tx.id}`), /immutable|permission denied/i);
  });

  it('admin pauses transaction progression (blocks customer tasks), resumes, then marks failed', async () => {
    const listing = await createLiveListing(seller);
    const thread = await acceptedThread(buyer, seller, listing);
    const tx = await callTx(buyer, (t) => t`select * from public.ensure_transaction(${thread}::uuid)`);
    const id = tx.id as string;

    await asAdmin(admin, (t) => t`select id from public.admin_pause_transaction(${id}::uuid, 'INFORMATION_UNDER_REVIEW')`);
    expect(await auditCount('ADMIN_TRANSACTION_PAUSED', id)).toBe(1);
    // A paused transaction blocks a customer task.
    const v = await asService((t: Sql) => t`select version from public.transactions where id = ${id}`);
    await expectError(() => callTx(buyer, (t) => t`select * from public.tx_complete_task(${id}::uuid, 'BUYER_CONFIRM_DETAILS', ${(v[0] as { version: number }).version})`), /PROGRESSION_PAUSED/);

    await asAdmin(admin, (t) => t`select id from public.admin_resume_transaction(${id}::uuid, 'ISSUE_RESOLVED')`);
    await asAdmin(admin, (t) => t`select id from public.admin_mark_transaction_failed(${id}::uuid, 'REPEATED_SYSTEM_FAILURE', 'SYSTEM')`);
    const st = await asService((t: Sql) => t`select status from public.transactions where id = ${id}`);
    expect((st[0] as { status: string }).status).toBe('FAILED');
    expect(await auditCount('ADMIN_TRANSACTION_MARKED_FAILED', id)).toBe(1);
  });

  it('admin document-access records the phased audit lifecycle; customer cannot; admin cannot edit audit history', async () => {
    const listing = await createLiveListing(seller);
    // Exact lifecycle: REQUESTED before minting, GRANTED on success (spec §23.2 / closure item 4).
    await asAdmin(admin, (t) => t`select public.admin_record_document_access('listing', ${listing}::uuid, 'OWNERSHIP', 'VERIFICATION_REVIEW', 'REQUESTED')`);
    await asAdmin(admin, (t) => t`select public.admin_record_document_access('listing', ${listing}::uuid, 'OWNERSHIP', 'VERIFICATION_REVIEW', 'GRANTED')`);
    // A failed mint records a FAILED result — never a false "accessed" event.
    await asAdmin(admin, (t) => t`select public.admin_record_document_access('listing', ${listing}::uuid, 'OWNERSHIP', 'VERIFICATION_REVIEW', 'FAILED')`);
    expect(await auditCount('ADMIN_DOCUMENT_ACCESS_REQUESTED', listing)).toBe(1);
    expect(await auditCount('ADMIN_DOCUMENT_ACCESS_GRANTED', listing)).toBe(1);
    expect(await auditCount('ADMIN_DOCUMENT_ACCESS_FAILED', listing)).toBe(1);
    await expectError(() => asUser(buyer, (t) => t`select public.admin_record_document_access('listing', ${listing}::uuid, 'OWNERSHIP', 'VERIFICATION_REVIEW', 'REQUESTED')`), /FORBIDDEN|permission denied/i);
    // Audit history is immutable even for admins (no update/delete grant).
    await expectError(() => asAdmin(admin, (t) => t`update public.audit_events set action = 'TAMPERED' where entity_id = ${listing}`), /permission denied/i);
  });
});

/** A DRAFT listing (not LIVE) for negative pause tests. */
async function createDraft(ownerId: string): Promise<string> {
  return asService(async (tx: Sql) => {
    const [l] = await tx`insert into public.listings (id, owner_id, title, state) values (gen_random_uuid(), ${ownerId}, 'Draft', 'DRAFT') returning id`;
    return (l as { id: string }).id;
  });
}
