/**
 * Week-4 pause / material-change behaviour — integration tests against live Postgres.
 * Asserts that pausing a listing closes active negotiations (never auto-resuming them),
 * and that a material change (listing version bump) blocks any further action on a
 * still-open thread so no offer is accepted against stale property information.
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
  console.warn('[integration] local Postgres not reachable — skipping listing-change suite');
}

async function createOffer(buyer: string, listing: string, amount: number): Promise<string> {
  return asUser(buyer, async (tx) => {
    const [t] = await tx`select * from public.create_offer(${listing}::uuid, ${amount}, null)`;
    return (t as { id: string }).id;
  });
}

async function threadRow(id: string): Promise<Record<string, unknown>> {
  return asService(async (tx: Sql) => {
    const [row] = await tx`select * from public.offer_threads where id = ${id}`;
    return row as Record<string, unknown>;
  });
}

d('pause + material-change behaviour (live DB)', () => {
  let seller: string;
  let buyer1: string;
  let buyer2: string;

  beforeAll(async () => {
    seller = await createPrincipal('lc_seller');
    buyer1 = await createPrincipal('lc_buyer1');
    buyer2 = await createPrincipal('lc_buyer2');
  });

  afterAll(async () => {
    await cleanup();
    await closePool();
  });

  it('pausing a listing closes every active offer thread (§28.1) and never auto-resumes', async () => {
    const listing = await createLiveListing(seller, { minNotificationPrice: null });
    const tA = await createOffer(buyer1, listing, 800_000);
    const tB = await createOffer(buyer2, listing, 810_000);

    // This is exactly what listing.pause runs (listing.ts calls close_listing_offers).
    await asUser(seller, (tx) => tx`select public.close_listing_offers(${listing}::uuid, 'LISTING_PAUSED')`);

    expect((await threadRow(tA)).status).toBe('CLOSED_LISTING_UNAVAILABLE');
    expect((await threadRow(tB)).status).toBe('CLOSED_LISTING_UNAVAILABLE');
    expect((await threadRow(tA)).next_actor).toBe('NONE');

    // A LISTING_PAUSED event is recorded on the timeline.
    const events = await asService(
      (tx: Sql) => tx`select count(*)::int as n from public.offer_events
                      where thread_id = ${tA} and event_type = 'LISTING_PAUSED'`,
    );
    expect((events[0] as { n: number }).n).toBe(1);

    // Closed threads are terminal — a later counter attempt is rejected (no silent reactivation).
    const t = await threadRow(tA);
    await expectError(
      () => asUser(seller, (tx) => tx`select public.submit_counter(${tA}::uuid, 900000, null, ${t.version as number})`),
      /NOT_ACTIONABLE/,
    );
  });

  it('a material change (listing version bump) blocks a counter on an open thread → LISTING_CHANGED', async () => {
    const listing = await createLiveListing(seller, { minNotificationPrice: null });
    const threadId = await createOffer(buyer1, listing, 700_000);
    const t = await threadRow(threadId);
    expect(t.listing_version).toBe(1);

    // Simulate a material listing change after the offer was made.
    await asService((tx: Sql) => tx`update public.listings set version = version + 1 where id = ${listing}`);

    // The thread's snapshot (v1) no longer matches the listing (v2) → guarded.
    await expectError(
      () => asUser(seller, (tx) => tx`select public.submit_counter(${threadId}::uuid, 720000, null, ${t.version as number})`),
      /LISTING_CHANGED/,
    );
  });

  it('a material change blocks ACCEPTANCE on an open thread → no acceptance against stale data', async () => {
    const listing = await createLiveListing(seller, { minNotificationPrice: null });
    const threadId = await createOffer(buyer1, listing, 700_000);
    const t = await threadRow(threadId);

    await asService((tx: Sql) => tx`update public.listings set version = version + 1 where id = ${listing}`);

    await expectError(
      () =>
        asUser(seller, (tx) =>
          tx`select public.accept_offer(${threadId}::uuid, ${t.current_proposal_id as string}::uuid, ${t.version as number})`,
        ),
      /LISTING_CHANGED/,
    );
    // Thread remains open (not accepted, not corrupted).
    expect((await threadRow(threadId)).status).toBe('AWAITING_SELLER');
  });

  it('a paused (non-LIVE) listing blocks new offers entirely', async () => {
    const listing = await createLiveListing(seller, { minNotificationPrice: null });
    await asService((tx: Sql) => tx`update public.listings set state = 'PAUSED' where id = ${listing}`);
    await expectError(() => createOffer(buyer1, listing, 500_000), /LISTING_UNAVAILABLE/);
  });
});
