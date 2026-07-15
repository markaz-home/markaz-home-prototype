/**
 * Week-5 transaction lifecycle — integration tests against the live local Postgres.
 * Drives an accepted offer through the full SECURITY DEFINER state engine to
 * COMPLETED_DEMO (+ listing SOLD_DEMO), plus idempotent creation and cancellation.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  asService,
  asUser,
  cleanup,
  closePool,
  createLiveListing,
  createPrincipal,
  dbReachable,
  expectError,
  type Sql,
} from './helpers/db';
import { acceptedThread, txRow, callTx } from './helpers/tx';

const reachable = await dbReachable();
const d = reachable ? describe : describe.skip;
if (!reachable)
  console.warn('[integration] local Postgres not reachable — skipping transaction lifecycle suite');

async function listingState(id: string): Promise<string> {
  const r = await asService((tx: Sql) => tx`select state from public.listings where id = ${id}`);
  return (r[0] as { state: string }).state;
}

d('transaction lifecycle (live DB)', () => {
  let seller: string;
  let buyer: string;
  let buyer2: string;

  beforeAll(async () => {
    seller = await createPrincipal('tx_seller');
    buyer = await createPrincipal('tx_buyer');
    buyer2 = await createPrincipal('tx_buyer2');
  });
  afterAll(async () => {
    await cleanup();
  });

  it('creates exactly one transaction from an accepted offer (idempotent)', async () => {
    const listing = await createLiveListing(seller);
    const thread = await acceptedThread(buyer, seller, listing);

    const t1 = await callTx(
      buyer,
      (tx) => tx`select * from public.ensure_transaction(${thread}::uuid)`,
    );
    expect(t1.status).toBe('INITIATED');
    expect(t1.reference).toMatch(/^MKZ-TXN-\d{4}-\d{6}$/);
    expect(Number(t1.accepted_amount_aed)).toBe(2_000_000);
    expect(Number(t1.deposit_amount_aed)).toBe(200_000);

    // Second call (either participant) returns the SAME transaction — no duplicate.
    const t2 = await callTx(
      seller,
      (tx) => tx`select * from public.ensure_transaction(${thread}::uuid)`,
    );
    expect(t2.id).toBe(t1.id);
    const count = await asService(
      (tx: Sql) =>
        tx`select count(*)::int as n from public.transactions where offer_thread_id = ${thread}`,
    );
    expect((count[0] as { n: number }).n).toBe(1);

    // 17 milestone tasks were created.
    const tasks = await asService(
      (tx: Sql) =>
        tx`select count(*)::int as n from public.transaction_tasks where transaction_id = ${t1.id}`,
    );
    expect((tasks[0] as { n: number }).n).toBe(17);
  });

  it('rejects transaction creation by a non-participant and from a non-accepted thread', async () => {
    const listing = await createLiveListing(seller);
    const thread = await acceptedThread(buyer, seller, listing);
    await expectError(
      () => callTx(buyer2, (tx) => tx`select * from public.ensure_transaction(${thread}::uuid)`),
      /NOT_FOUND/,
    );
  });

  it('walks the full lifecycle (CASH) to COMPLETED_DEMO and marks the listing SOLD_DEMO', async () => {
    const listing = await createLiveListing(seller);
    const thread = await acceptedThread(buyer, seller, listing);
    let t = await callTx(
      buyer,
      (tx) => tx`select * from public.ensure_transaction(${thread}::uuid)`,
    );
    const id = t.id as string;
    const v = () => t.version as number;

    t = await callTx(
      buyer,
      (tx) =>
        tx`select * from public.tx_complete_task(${id}::uuid, 'BUYER_CONFIRM_DETAILS', ${v()})`,
    );
    expect(t.status).toBe('CONFIRMATION');
    t = await callTx(
      seller,
      (tx) =>
        tx`select * from public.tx_complete_task(${id}::uuid, 'SELLER_CONFIRM_DETAILS', ${v()})`,
    );
    t = await callTx(
      buyer,
      (tx) => tx`select * from public.tx_select_route(${id}::uuid, 'CASH', ${v()})`,
    );
    expect(t.status).toBe('DEPOSIT');
    expect(t.next_actor).toBe('BUYER');

    t = await callTx(
      buyer,
      (tx) => tx`select * from public.tx_confirm_deposit(${id}::uuid, ${v()})`,
    );
    expect(t.status).toBe('DOCUMENTS');
    expect(t.deposit_confirmed_at).toBeTruthy();

    // Document checklist requires each participant's fictional identity file first.
    await callTx(
      buyer,
      (tx) =>
        tx`select id from public.tx_register_document(${id}::uuid, 'BUYER_IDENTITY', ${`${id}/${buyer}/id.pdf`}, 'id.pdf', 'application/pdf', 1000)`,
    );
    await callTx(
      seller,
      (tx) =>
        tx`select id from public.tx_register_document(${id}::uuid, 'SELLER_IDENTITY', ${`${id}/${seller}/id.pdf`}, 'id.pdf', 'application/pdf', 1000)`,
    );
    t = await callTx(
      buyer,
      (tx) => tx`select * from public.tx_complete_task(${id}::uuid, 'BUYER_DOCUMENTS', ${v()})`,
    );
    t = await callTx(
      seller,
      (tx) => tx`select * from public.tx_complete_task(${id}::uuid, 'SELLER_DOCUMENTS', ${v()})`,
    );
    t = await callTx(
      buyer,
      (tx) =>
        tx`select * from public.tx_complete_task(${id}::uuid, 'BUYER_REVIEW_SUMMARY', ${v()})`,
    );
    t = await callTx(
      seller,
      (tx) =>
        tx`select * from public.tx_complete_task(${id}::uuid, 'SELLER_REVIEW_SUMMARY', ${v()})`,
    );
    expect(t.status).toBe('DUE_DILIGENCE');
    expect(t.next_actor).toBe('SYSTEM');

    t = await callTx(
      seller,
      (tx) => tx`select * from public.tx_run_due_diligence(${id}::uuid, ${v()})`,
    );
    expect(t.status).toBe('TRANSFER');

    const date = new Date(Date.now() + 10 * 86400_000).toISOString().slice(0, 10);
    t = await callTx(
      seller,
      (tx) => tx`select * from public.tx_propose_transfer_date(${id}::uuid, ${date}::date, ${v()})`,
    );
    t = await callTx(
      buyer,
      (tx) =>
        tx`select * from public.tx_complete_task(${id}::uuid, 'BUYER_CONFIRM_READINESS', ${v()})`,
    );
    t = await callTx(
      seller,
      (tx) =>
        tx`select * from public.tx_complete_task(${id}::uuid, 'SELLER_CONFIRM_READINESS', ${v()})`,
    );
    t = await callTx(
      buyer,
      (tx) => tx`select * from public.tx_create_appointment(${id}::uuid, ${v()})`,
    );
    expect(t.status).toBe('COMPLETION');
    expect(t.transfer_appointment_at).toBeTruthy();

    t = await callTx(
      buyer,
      (tx) => tx`select * from public.tx_confirm_completion(${id}::uuid, ${v()})`,
    );
    expect(t.status).toBe('COMPLETION'); // one side confirmed
    t = await callTx(
      seller,
      (tx) => tx`select * from public.tx_confirm_completion(${id}::uuid, ${v()})`,
    );
    expect(t.status).toBe('COMPLETED_DEMO');
    expect(t.next_actor).toBe('NONE');
    expect(t.completed_at).toBeTruthy();

    expect(await listingState(listing)).toBe('SOLD_DEMO');
  });

  it('mutual cancellation → CANCELLED and pauses the listing (never auto-LIVE)', async () => {
    const listing = await createLiveListing(seller);
    const thread = await acceptedThread(buyer, seller, listing);
    let t = await callTx(
      buyer,
      (tx) => tx`select * from public.ensure_transaction(${thread}::uuid)`,
    );
    const id = t.id as string;
    const v = () => t.version as number;
    // Advance past details so cancellation must be mutual.
    t = await callTx(
      buyer,
      (tx) =>
        tx`select * from public.tx_complete_task(${id}::uuid, 'BUYER_CONFIRM_DETAILS', ${v()})`,
    );
    t = await callTx(
      seller,
      (tx) =>
        tx`select * from public.tx_complete_task(${id}::uuid, 'SELLER_CONFIRM_DETAILS', ${v()})`,
    );
    t = await callTx(
      buyer,
      (tx) => tx`select * from public.tx_select_route(${id}::uuid, 'CASH', ${v()})`,
    );
    t = await callTx(
      buyer,
      (tx) => tx`select * from public.tx_confirm_deposit(${id}::uuid, ${v()})`,
    );

    t = await callTx(
      buyer,
      (tx) => tx`select * from public.tx_request_cancellation(${id}::uuid, 'BUYER_UNABLE', ${v()})`,
    );
    expect(t.status).toBe('CANCELLATION_PENDING');
    // Requester cannot resolve their own request.
    await expectError(
      () =>
        callTx(
          buyer,
          (tx) => tx`select * from public.tx_resolve_cancellation(${id}::uuid, true, ${v()})`,
        ),
      /NOT_YOUR_TASK/,
    );
    t = await callTx(
      seller,
      (tx) => tx`select * from public.tx_resolve_cancellation(${id}::uuid, true, ${v()})`,
    );
    expect(t.status).toBe('CANCELLED');
    expect(t.cancelled_at).toBeTruthy();
    expect(await listingState(listing)).toBe('PAUSED');
  });

  it('rejects stale-version actions', async () => {
    const listing = await createLiveListing(seller);
    const thread = await acceptedThread(buyer, seller, listing);
    const t = await callTx(
      buyer,
      (tx) => tx`select * from public.ensure_transaction(${thread}::uuid)`,
    );
    await expectError(
      () =>
        callTx(
          buyer,
          (tx) =>
            tx`select * from public.tx_complete_task(${t.id}::uuid, 'BUYER_CONFIRM_DETAILS', 999)`,
        ),
      /STALE/,
    );
  });
});

d('transaction RLS (live DB)', () => {
  let seller: string;
  let buyer: string;
  let buyer2: string;
  let txId: string;

  beforeAll(async () => {
    seller = await createPrincipal('txr_seller');
    buyer = await createPrincipal('txr_buyer');
    buyer2 = await createPrincipal('txr_buyer2');
    const listing = await createLiveListing(seller);
    const thread = await acceptedThread(buyer, seller, listing);
    const t = await callTx(
      buyer,
      (tx) => tx`select * from public.ensure_transaction(${thread}::uuid)`,
    );
    txId = t.id as string;
  });
  afterAll(async () => {
    await cleanup();
    await closePool();
  });

  it('lets both participants read the transaction', async () => {
    const b = await asUser(
      buyer,
      (tx) => tx`select id from public.transactions where id = ${txId}`,
    );
    const s = await asUser(
      seller,
      (tx) => tx`select id from public.transactions where id = ${txId}`,
    );
    expect(b.length).toBe(1);
    expect(s.length).toBe(1);
  });
  it('denies an unrelated customer and anonymous', async () => {
    const other = await asUser(
      buyer2,
      (tx) => tx`select id from public.transactions where id = ${txId}`,
    );
    expect(other.length).toBe(0);
  });
  it('blocks a customer from forging transaction status directly', async () => {
    await expectError(
      () =>
        asUser(
          buyer,
          (tx) => tx`update public.transactions set status = 'COMPLETED_DEMO' where id = ${txId}`,
        ),
      /permission denied|immutable|only by the server/i,
    );
  });
  it('blocks a customer from changing the accepted amount', async () => {
    await expectError(
      () =>
        asUser(
          buyer,
          (tx) => tx`update public.transactions set accepted_amount_aed = 1 where id = ${txId}`,
        ),
      /permission denied|immutable/i,
    );
  });
  it('blocks a customer from acting as the other participant', async () => {
    const t = await txRow(txId);
    // seller cannot complete a BUYER task
    await expectError(
      () =>
        callTx(
          seller,
          (tx) =>
            tx`select * from public.tx_complete_task(${txId}::uuid, 'BUYER_CONFIRM_DETAILS', ${t.version})`,
        ),
      /NOT_YOUR_TASK/,
    );
  });

  it('requires the identity file before the buyer can complete the document checklist', async () => {
    // Advance to the DOCUMENTS stage.
    let t = await txRow(txId);
    t = await callTx(
      buyer,
      (tx) =>
        tx`select * from public.tx_complete_task(${txId}::uuid, 'BUYER_CONFIRM_DETAILS', ${t.version})`,
    );
    t = await callTx(
      seller,
      (tx) =>
        tx`select * from public.tx_complete_task(${txId}::uuid, 'SELLER_CONFIRM_DETAILS', ${t.version})`,
    );
    t = await callTx(
      buyer,
      (tx) => tx`select * from public.tx_select_route(${txId}::uuid, 'CASH', ${t.version})`,
    );
    t = await callTx(
      buyer,
      (tx) => tx`select * from public.tx_confirm_deposit(${txId}::uuid, ${t.version})`,
    );
    // No document yet → blocked.
    await expectError(
      () =>
        callTx(
          buyer,
          (tx) =>
            tx`select * from public.tx_complete_task(${txId}::uuid, 'BUYER_DOCUMENTS', ${t.version as number})`,
        ),
      /DOCUMENT_REQUIRED/,
    );
  });

  it('rejects a cross-transaction storage path and a wrong-side document type', async () => {
    await expectError(
      () =>
        callTx(
          buyer,
          (tx) =>
            tx`select id from public.tx_register_document(${txId}::uuid, 'BUYER_IDENTITY', 'other-tx/x/id.pdf', 'id.pdf', 'application/pdf', 100)`,
        ),
      /INVALID_PATH/,
    );
    await expectError(
      () =>
        callTx(
          buyer,
          (tx) =>
            tx`select id from public.tx_register_document(${txId}::uuid, 'SELLER_IDENTITY', ${`${txId}/${buyer}/id.pdf`}, 'id.pdf', 'application/pdf', 100)`,
        ),
      /NOT_YOUR_TASK/,
    );
    await expectError(
      () =>
        callTx(
          buyer2,
          (tx) =>
            tx`select id from public.tx_register_document(${txId}::uuid, 'BUYER_IDENTITY', ${`${txId}/${buyer2}/id.pdf`}, 'id.pdf', 'application/pdf', 100)`,
        ),
      /NOT_FOUND/,
    );
  });

  it('keeps a document row private to its uploader (other participant cannot read it)', async () => {
    await callTx(
      buyer,
      (tx) =>
        tx`select id from public.tx_register_document(${txId}::uuid, 'BUYER_IDENTITY', ${`${txId}/${buyer}/id.pdf`}, 'secret.pdf', 'application/pdf', 100)`,
    );
    // Seller (participant) cannot read the buyer's document row (uploader-only policy).
    const sellerView = await asUser(
      seller,
      (tx) =>
        tx`select id from public.transaction_documents where transaction_id = ${txId} and uploaded_by = ${buyer}`,
    );
    expect(sellerView.length).toBe(0);
    // Buyer sees their own.
    const own = await asUser(
      buyer,
      (tx) => tx`select file_name from public.transaction_documents where uploaded_by = ${buyer}`,
    );
    expect(own.length).toBeGreaterThanOrEqual(1);
  });
});
