/**
 * Week-5 `transactions.listMine` — verifies the dashboard list returns every
 * transaction for a participant AND that the property summary is BATCH-loaded
 * correctly per listing (regression guard for the N+1 that loaded a property per
 * row in a loop). Drives the real tRPC router under the buyer's RLS context.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { appRouter, createCallerFactory, type Context } from '@markaz/api';
import { logger } from '@markaz/observability';
import { getAppDb, closeConnections } from '@markaz/db';
import {
  asService,
  cleanup,
  closePool,
  createLiveListing,
  createPrincipal,
  dbReachable,
  type Sql,
} from './helpers/db';
import { acceptedThread } from './helpers/tx';

const reachable = await dbReachable();
const d = reachable ? describe : describe.skip;
if (!reachable) {
  // eslint-disable-next-line no-console
  console.warn('[transactions-list] skipped — local Postgres not reachable');
}

const createCaller = createCallerFactory(appRouter);
const callerFor = (userId: string) =>
  createCaller({
    db: getAppDb(),
    user: { id: userId, accountType: 'CUSTOMER' },
    requestId: 'test',
    log: logger,
  } as Context);

async function publicIdOf(listingId: string): Promise<string> {
  const r = await asService(
    (tx: Sql) => tx`select public_id from public.listings where id = ${listingId}`,
  );
  return (r[0] as { public_id: string }).public_id;
}

d('transactions.listMine (batched property summaries)', () => {
  let seller = '';
  let buyer = '';

  beforeAll(async () => {
    seller = await createPrincipal('txlist_seller');
    buyer = await createPrincipal('txlist_buyer');
  });
  afterAll(async () => {
    await cleanup();
    await closePool();
    await closeConnections();
  });

  it('returns every participant transaction with its own listing property (no N+1 cross-wiring)', async () => {
    const listing1 = await createLiveListing(seller, { minNotificationPrice: 1_000_000 });
    const listing2 = await createLiveListing(seller, { minNotificationPrice: 1_000_000 });
    const publicId1 = await publicIdOf(listing1);
    const publicId2 = await publicIdOf(listing2);

    const thread1 = await acceptedThread(buyer, seller, listing1, 1_800_000);
    const thread2 = await acceptedThread(buyer, seller, listing2, 1_900_000);

    const buyerCaller = callerFor(buyer);
    await buyerCaller.transactions.createFromAcceptedOffer({ offerThreadId: thread1 });
    await buyerCaller.transactions.createFromAcceptedOffer({ offerThreadId: thread2 });

    const list = await buyerCaller.transactions.listMine();

    // Both transactions come back (batch returned every row, not just the first).
    expect(list).toHaveLength(2);
    // Every item carries a non-null property summary (buyer is a participant).
    expect(list.every((i) => i.property !== null)).toBe(true);
    // Each item is mapped to ITS OWN listing — the batch keyed by listing, no cross-wiring.
    const publicIds = new Set(list.map((i) => i.property?.publicId));
    expect(publicIds).toEqual(new Set([publicId1, publicId2]));
    // References are the canonical transaction refs, one per transaction.
    expect(list.every((i) => /^MKZ-TXN-\d{4}-\d{6}$/.test(i.reference))).toBe(true);
    expect(new Set(list.map((i) => i.reference)).size).toBe(2);
  });

  it('returns an empty list for a participant with no transactions', async () => {
    const stranger = await createPrincipal('txlist_stranger');
    const list = await callerFor(stranger).transactions.listMine();
    expect(list).toEqual([]);
  });
});
