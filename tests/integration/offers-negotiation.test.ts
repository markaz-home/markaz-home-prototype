/**
 * Week-4 offer negotiation — integration tests against the live local Postgres.
 * Exercises create → counter → accept through the SECURITY DEFINER functions and
 * asserts proposal immutability, other-thread closure, new-offer blocking, and the
 * notification/email delivery rules.
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

const reachable = await dbReachable();
const d = reachable ? describe : describe.skip;
if (!reachable) {
  // eslint-disable-next-line no-console
  console.warn('[integration] local Postgres not reachable — skipping offer negotiation suite');
}

async function threadRow(id: string): Promise<Record<string, unknown>> {
  return asService(async (tx: Sql) => {
    const [row] = await tx`select * from public.offer_threads where id = ${id}`;
    return row as Record<string, unknown>;
  });
}

async function createOffer(buyer: string, listing: string, amount: number): Promise<string> {
  return asUser(buyer, async (tx) => {
    const [t] = await tx`select * from public.create_offer(${listing}::uuid, ${amount}, null)`;
    return (t as { id: string }).id;
  });
}

d('offer negotiation (live DB)', () => {
  let seller: string;
  let buyer1: string;
  let buyer2: string;
  let buyer3: string;
  let listing: string;
  let belowThresholdThread: string;

  beforeAll(async () => {
    seller = await createPrincipal('seller');
    buyer1 = await createPrincipal('buyer1');
    buyer2 = await createPrincipal('buyer2');
    buyer3 = await createPrincipal('buyer3');
    listing = await createLiveListing(seller, { minNotificationPrice: 1_000_000 });
  });

  afterAll(async () => {
    await cleanup();
    await closePool();
  });

  it('creates a thread in AWAITING_SELLER with the buyer proposal as current', async () => {
    belowThresholdThread = await createOffer(buyer1, listing, 900_000);
    const t = await threadRow(belowThresholdThread);
    expect(t.status).toBe('AWAITING_SELLER');
    expect(t.next_actor).toBe('SELLER');
    expect(t.buyer_user_id).toBe(buyer1);
    expect(t.seller_user_id).toBe(seller);
    expect(t.current_proposal_id).toBeTruthy();
  });

  it('blocks a second active thread for the same buyer+listing (idempotency backstop)', async () => {
    // buyer1 already has an active thread from the previous test.
    await expectError(
      () => createOffer(buyer1, listing, 950_000),
      /duplicate key|unique|uniq_active_thread/i,
    );
  });

  it('rejects a buyer offering on their own listing', async () => {
    await expectError(() => createOffer(seller, listing, 900_000), /OWN_LISTING/);
  });

  it('notifies and queues exactly one seller email even below the private threshold', async () => {
    const notifs = await asService(
      (tx) =>
        tx`select id from public.notifications
           where recipient_id = ${seller}
             and kind = 'OFFER_RECEIVED'
             and payload->>'threadId' = ${belowThresholdThread}`,
    );
    expect(notifs).toHaveLength(1);
    const outbox = await asService(
      (tx) =>
        tx`select count(*)::int as n from private.notification_email_outbox
           where notification_id = ${(notifs[0] as { id: string }).id}`,
    );
    expect((outbox[0] as { n: number }).n).toBe(1);

    const visible = await asUser(
      seller,
      (tx) => tx`select count(*)::int as n from public.offer_threads where listing_id = ${listing}`,
    );
    expect((visible[0] as { n: number }).n).toBeGreaterThanOrEqual(1);
  });

  it('DOES notify the seller for an at/above-threshold offer', async () => {
    const threadId = await createOffer(buyer2, listing, 1_100_000);
    const notifs = await asService(
      (tx) =>
        tx`select count(*)::int as n from public.notifications
           where recipient_id = ${seller} and kind = 'OFFER_RECEIVED'
             and payload->>'threadId' = ${threadId}`,
    );
    expect((notifs[0] as { n: number }).n).toBe(1);
  });

  it('creates one in-app buyer view receipt per buyer proposal and never an email', async () => {
    const l = await createLiveListing(seller);
    const threadId = await createOffer(buyer3, l, 700_000);

    await Promise.all([
      asUser(seller, (tx) => tx`select public.mark_offer_viewed(${threadId}::uuid)`),
      asUser(seller, (tx) => tx`select public.mark_offer_viewed(${threadId}::uuid)`),
    ]);
    let rows = await asService(
      (tx) =>
        tx`select id from public.notifications
           where recipient_id = ${buyer3} and kind = 'OFFER_VIEWED'
             and payload->>'threadId' = ${threadId}`,
    );
    expect(rows).toHaveLength(1);
    let outbox = await asService(
      (tx) =>
        tx`select count(*)::int as n from private.notification_email_outbox
           where notification_id = ${(rows[0] as { id: string }).id}`,
    );
    expect((outbox[0] as { n: number }).n).toBe(0);

    let thread = await threadRow(threadId);
    await asUser(
      seller,
      (tx) => tx`select public.submit_counter(${threadId}::uuid, 750000, null, ${thread.version as number})`,
    );
    thread = await threadRow(threadId);
    await asUser(
      buyer3,
      (tx) => tx`select public.submit_counter(${threadId}::uuid, 725000, null, ${thread.version as number})`,
    );
    await asUser(seller, (tx) => tx`select public.mark_offer_viewed(${threadId}::uuid)`);
    rows = await asService(
      (tx) =>
        tx`select id from public.notifications
           where recipient_id = ${buyer3} and kind = 'OFFER_VIEWED'
             and payload->>'threadId' = ${threadId}`,
    );
    expect(rows).toHaveLength(2);
    outbox = await asService(
      (tx) =>
        tx`select count(*)::int as n from private.notification_email_outbox o
           join public.notifications n on n.id = o.notification_id
           where n.recipient_id = ${buyer3} and n.kind = 'OFFER_VIEWED'
             and n.payload->>'threadId' = ${threadId}`,
    );
    expect((outbox[0] as { n: number }).n).toBe(0);
  });

  it('preserves full immutable proposal history across a counter', async () => {
    // Fresh listing/thread to isolate the history assertion.
    const l2 = await createLiveListing(seller, { minNotificationPrice: null });
    const threadId = await createOffer(buyer3, l2, 500_000);
    let t = await threadRow(threadId);

    // Seller counters at 600k.
    await asUser(
      seller,
      (tx) =>
        tx`select public.submit_counter(${threadId}::uuid, 600000, null, ${t.version as number})`,
    );
    t = await threadRow(threadId);
    expect(t.status).toBe('AWAITING_BUYER');
    expect(t.next_actor).toBe('BUYER');

    // Buyer counters at 550k.
    await asUser(
      buyer3,
      (tx) =>
        tx`select public.submit_counter(${threadId}::uuid, 550000, null, ${t.version as number})`,
    );

    const proposals = await asService(
      (tx) =>
        tx`select amount_aed::int as amount, status, created_by_side
           from public.offer_proposals where thread_id = ${threadId} order by created_at`,
    );
    // Three distinct rows; the earlier two are frozen at their original amounts.
    expect(proposals.map((p) => (p as { amount: number }).amount)).toEqual([
      500_000, 600_000, 550_000,
    ]);
    expect((proposals[0] as { status: string }).status).toBe('SUPERSEDED');
    expect((proposals[1] as { status: string }).status).toBe('SUPERSEDED');
    expect((proposals[2] as { status: string }).status).toBe('CURRENT');
  });

  it('rejects an equal-amount counter (must accept instead)', async () => {
    const l = await createLiveListing(seller);
    const threadId = await createOffer(buyer1, l, 700_000);
    const t = await threadRow(threadId);
    await expectError(
      () =>
        asUser(
          seller,
          (tx) =>
            tx`select public.submit_counter(${threadId}::uuid, 700000, null, ${t.version as number})`,
        ),
      /EQUAL_AMOUNT/,
    );
  });

  it('rejects a stale-version action (two-tab conflict)', async () => {
    const l = await createLiveListing(seller);
    const threadId = await createOffer(buyer1, l, 700_000);
    // Wrong expected version → STALE.
    await expectError(
      () =>
        asUser(
          seller,
          (tx) => tx`select public.submit_counter(${threadId}::uuid, 800000, null, 999)`,
        ),
      /STALE/,
    );
  });

  it('accepts one offer, closes the other thread, and blocks new offers', async () => {
    const l = await createLiveListing(seller, { minNotificationPrice: null });
    const tA = await createOffer(buyer1, l, 800_000);
    const tB = await createOffer(buyer2, l, 820_000);

    // Seller accepts buyer2's proposal on thread B.
    const b = await threadRow(tB);
    await asUser(
      seller,
      (tx) =>
        tx`select public.accept_offer(${tB}::uuid, ${b.current_proposal_id as string}::uuid, ${b.version as number})`,
    );

    const after = await threadRow(tB);
    expect(after.status).toBe('ACCEPTED');
    expect(after.next_actor).toBe('NONE');
    expect(after.accepted_proposal_id).toBe(b.current_proposal_id);

    const transaction = await asService(
      (tx) => tx`select id from public.transactions where offer_thread_id = ${tB}`,
    );
    expect(transaction).toHaveLength(1);
    const acceptedEmails = await asService(
      (tx) =>
        tx`select count(*)::int as n
           from private.notification_email_outbox o
           join public.notifications n on n.id = o.notification_id
           where n.kind = 'TRANSACTION_CREATED'
             and n.payload->>'transactionId' = ${(transaction[0] as { id: string }).id}`,
    );
    expect((acceptedEmails[0] as { n: number }).n).toBe(2);

    const other = await threadRow(tA);
    expect(other.status).toBe('CLOSED_OTHER_ACCEPTED');
    expect(other.next_actor).toBe('NONE');

    // New offers on the listing are blocked (derived UNDER_OFFER).
    await expectError(() => createOffer(buyer3, l, 900_000), /UNDER_OFFER/);
  });

  it('enforces at most one accepted thread per listing at the DB level', async () => {
    const l = await createLiveListing(seller, { minNotificationPrice: null });
    const tA = await createOffer(buyer1, l, 800_000);
    const tB = await createOffer(buyer2, l, 810_000);
    const a = await threadRow(tA);
    await asUser(
      seller,
      (tx) =>
        tx`select public.accept_offer(${tA}::uuid, ${a.current_proposal_id as string}::uuid, ${a.version as number})`,
    );
    // Second thread was auto-closed; trying to accept it now fails (not actionable).
    const b = await threadRow(tB);
    expect(b.status).toBe('CLOSED_OTHER_ACCEPTED');
    await expectError(
      () =>
        asUser(
          seller,
          (tx) =>
            tx`select public.accept_offer(${tB}::uuid, ${b.current_proposal_id as string}::uuid, ${b.version as number})`,
        ),
      /NOT_ACTIONABLE|STALE/,
    );
  });
});
