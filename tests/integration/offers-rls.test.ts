/**
 * Week-4 offer RLS + write-boundary — integration tests against the live local Postgres.
 * These assert the ACTUAL database boundary (not just tRPC): who can read a thread,
 * and that customers cannot forge state, mutate immutable proposals, or write
 * notifications for anyone (or themselves).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  asAnon,
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
  console.warn('[integration] local Postgres not reachable — skipping offer RLS suite');
}

d('offer RLS + write boundary (live DB)', () => {
  let seller: string;
  let seller2: string;
  let buyer1: string;
  let buyer2: string;
  let listing: string;
  let threadId: string;
  let currentProposalId: string;

  beforeAll(async () => {
    seller = await createPrincipal('rls_seller');
    seller2 = await createPrincipal('rls_seller2');
    buyer1 = await createPrincipal('rls_buyer1');
    buyer2 = await createPrincipal('rls_buyer2');
    listing = await createLiveListing(seller, { minNotificationPrice: 1_000_000 });
    threadId = await asUser(buyer1, async (tx) => {
      const [t] = await tx`select * from public.create_offer(${listing}::uuid, 900000, null)`;
      return (t as { id: string }).id;
    });
    const t = await asService((tx: Sql) => tx`select current_proposal_id from public.offer_threads where id = ${threadId}`);
    currentProposalId = (t[0] as { current_proposal_id: string }).current_proposal_id;
  });

  afterAll(async () => {
    await cleanup();
    await closePool();
  });

  it('lets the participant buyer read their own thread', async () => {
    const rows = await asUser(buyer1, (tx) => tx`select id from public.offer_threads where id = ${threadId}`);
    expect(rows.length).toBe(1);
  });

  it('lets the participant seller (listing owner) read the thread', async () => {
    const rows = await asUser(seller, (tx) => tx`select id from public.offer_threads where id = ${threadId}`);
    expect(rows.length).toBe(1);
  });

  it('denies a different buyer any visibility of the thread', async () => {
    const rows = await asUser(buyer2, (tx) => tx`select id from public.offer_threads where id = ${threadId}`);
    expect(rows.length).toBe(0);
  });

  it('denies a different seller any visibility of the thread', async () => {
    const rows = await asUser(seller2, (tx) => tx`select id from public.offer_threads where id = ${threadId}`);
    expect(rows.length).toBe(0);
  });

  it('denies anonymous access to offer threads entirely', async () => {
    // anon has no grant/policy: either 0 rows or a hard permission error — both are "no access".
    let count = -1;
    try {
      const rows = await asAnon((tx) => tx`select id from public.offer_threads where id = ${threadId}`);
      count = rows.length;
    } catch (e) {
      expect(String(e)).toMatch(/permission denied/i);
      return;
    }
    expect(count).toBe(0);
  });

  it('denies a non-participant buyer from reading the proposals', async () => {
    const rows = await asUser(buyer2, (tx) => tx`select id from public.offer_proposals where thread_id = ${threadId}`);
    expect(rows.length).toBe(0);
  });

  it('blocks a customer from forging thread status to ACCEPTED directly', async () => {
    await expectError(
      () => asUser(buyer1, (tx) => tx`update public.offer_threads set status = 'ACCEPTED' where id = ${threadId}`),
      /permission denied|immutable|only by the server/i,
    );
  });

  it('blocks a customer from forging next_actor directly', async () => {
    await expectError(
      () => asUser(buyer1, (tx) => tx`update public.offer_threads set next_actor = 'BUYER' where id = ${threadId}`),
      /permission denied|immutable|only by the server/i,
    );
  });

  it('blocks a customer from mutating an immutable proposal amount', async () => {
    await expectError(
      () => asUser(buyer1, (tx) => tx`update public.offer_proposals set amount_aed = 1 where id = ${currentProposalId}`),
      /permission denied|immutable/i,
    );
  });

  it('blocks a customer from inserting a proposal directly on any thread', async () => {
    await expectError(
      () =>
        asUser(buyer2, (tx) =>
          tx`insert into public.offer_proposals (thread_id, created_by_user_id, created_by_side, amount_aed)
             values (${threadId}, ${buyer2}, 'BUYER', 1)`,
        ),
      /permission denied|violates row-level security|new row violates/i,
    );
  });

  it('blocks a customer from performing the seller counter (turn/role enforced server-side)', async () => {
    const t = await asService((tx: Sql) => tx`select version from public.offer_threads where id = ${threadId}`);
    const version = (t[0] as { version: number }).version;
    // buyer1 tries to act while it is the SELLER's turn → NOT_YOUR_TURN.
    await expectError(
      () => asUser(buyer1, (tx) => tx`select public.submit_counter(${threadId}::uuid, 950000, null, ${version})`),
      /NOT_YOUR_TURN/,
    );
  });

  it('notifications are recipient-scoped: a customer cannot read another user notifications', async () => {
    // Seed a notification for buyer1 via the server path (seller counters).
    const t = await asService((tx: Sql) => tx`select version from public.offer_threads where id = ${threadId}`);
    await asUser(seller, (tx) =>
      tx`select public.submit_counter(${threadId}::uuid, 1000000, null, ${(t[0] as { version: number }).version})`,
    );
    // buyer2 must not see buyer1's notifications.
    const rows = await asUser(buyer2, (tx) => tx`select id from public.notifications where recipient_id = ${buyer1}`);
    expect(rows.length).toBe(0);
    // buyer1 sees their own.
    const own = await asUser(buyer1, (tx) => tx`select id from public.notifications where recipient_id = ${buyer1}`);
    expect(own.length).toBeGreaterThanOrEqual(1);
  });

  it('blocks a customer from inserting a forged notification', async () => {
    await expectError(
      () =>
        asUser(buyer1, (tx) =>
          tx`insert into public.notifications (recipient_id, channel, kind, payload)
             values (${buyer1}, 'IN_APP', 'OFFER_ACCEPTED', '{}'::jsonb)`,
        ),
      /permission denied|violates row-level security|new row violates/i,
    );
  });
});
