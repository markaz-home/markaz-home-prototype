/**
 * Week-4 single-accepted-offer concurrency — integration test against live Postgres.
 * The core safety invariant: under two simultaneous accept attempts, EXACTLY ONE
 * wins and the listing never ends up with two accepted threads. Guaranteed by the
 * listing-row lock in accept_offer plus the `uniq_accepted_thread_per_listing`
 * partial unique index.
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
  type Sql,
} from './helpers/db';

const reachable = await dbReachable();
const d = reachable ? describe : describe.skip;
if (!reachable) {
  // eslint-disable-next-line no-console
  console.warn('[integration] local Postgres not reachable — skipping offer concurrency suite');
}

// Any of these mean "this attempt lost the race" — all are acceptable losers.
const LOSER = /STALE|ALREADY_ACCEPTED|NOT_ACTIONABLE|deadlock|could not serialize|conflict/i;

async function settle<T>(p: Promise<T>): Promise<{ ok: boolean; err?: string }> {
  try {
    await p;
    return { ok: true };
  } catch (e) {
    return { ok: false, err: e instanceof Error ? e.message : String(e) };
  }
}

d('single accepted offer under concurrency (live DB)', () => {
  let seller: string;
  let buyer1: string;
  let buyer2: string;

  beforeAll(async () => {
    seller = await createPrincipal('cc_seller');
    buyer1 = await createPrincipal('cc_buyer1');
    buyer2 = await createPrincipal('cc_buyer2');
  });

  afterAll(async () => {
    await cleanup();
    await closePool();
  });

  it('two simultaneous accepts of two competing threads → exactly one winner', async () => {
    const listing = await createLiveListing(seller, { minNotificationPrice: null });
    const tA = await asUser(buyer1, async (tx) => {
      const [t] = await tx`select * from public.create_offer(${listing}::uuid, 800000, null)`;
      return (t as { id: string }).id;
    });
    const tB = await asUser(buyer2, async (tx) => {
      const [t] = await tx`select * from public.create_offer(${listing}::uuid, 820000, null)`;
      return (t as { id: string }).id;
    });

    const a = await asService((tx: Sql) => tx`select current_proposal_id, version from public.offer_threads where id = ${tA}`);
    const b = await asService((tx: Sql) => tx`select current_proposal_id, version from public.offer_threads where id = ${tB}`);
    const aRow = a[0] as { current_proposal_id: string; version: number };
    const bRow = b[0] as { current_proposal_id: string; version: number };

    // Fire both accepts concurrently (separate connections via separate transactions).
    const [rA, rB] = await Promise.all([
      settle(
        asUser(seller, (tx) =>
          tx`select public.accept_offer(${tA}::uuid, ${aRow.current_proposal_id}::uuid, ${aRow.version})`,
        ),
      ),
      settle(
        asUser(seller, (tx) =>
          tx`select public.accept_offer(${tB}::uuid, ${bRow.current_proposal_id}::uuid, ${bRow.version})`,
        ),
      ),
    ]);

    const winners = [rA, rB].filter((r) => r.ok).length;
    const losers = [rA, rB].filter((r) => !r.ok);
    expect(winners).toBe(1);
    for (const l of losers) expect(l.err ?? '').toMatch(LOSER);

    // DB invariant: exactly one ACCEPTED thread; the other is CLOSED_OTHER_ACCEPTED.
    const rows = await asService(
      (tx: Sql) => tx`select status, count(*)::int as n from public.offer_threads
                      where listing_id = ${listing} group by status order by status`,
    );
    const byStatus = Object.fromEntries(rows.map((r) => [(r as { status: string }).status, (r as { n: number }).n]));
    expect(byStatus.ACCEPTED).toBe(1);
    expect(byStatus.CLOSED_OTHER_ACCEPTED ?? 0).toBe(1);
    expect(byStatus.AWAITING_SELLER ?? 0).toBe(0);
  });

  it('two simultaneous accepts of the SAME thread → exactly one winner', async () => {
    const listing = await createLiveListing(seller, { minNotificationPrice: null });
    const t = await asUser(buyer1, async (tx) => {
      const [row] = await tx`select * from public.create_offer(${listing}::uuid, 750000, null)`;
      return (row as { id: string }).id;
    });
    const meta = await asService((tx: Sql) => tx`select current_proposal_id, version from public.offer_threads where id = ${t}`);
    const m = meta[0] as { current_proposal_id: string; version: number };

    const [r1, r2] = await Promise.all([
      settle(asUser(seller, (tx) => tx`select public.accept_offer(${t}::uuid, ${m.current_proposal_id}::uuid, ${m.version})`)),
      settle(asUser(seller, (tx) => tx`select public.accept_offer(${t}::uuid, ${m.current_proposal_id}::uuid, ${m.version})`)),
    ]);

    expect([r1, r2].filter((r) => r.ok).length).toBe(1);
    const losers = [r1, r2].filter((r) => !r.ok);
    for (const l of losers) expect(l.err ?? '').toMatch(LOSER);

    const accepted = await asService(
      (tx: Sql) => tx`select count(*)::int as n from public.offer_threads where listing_id = ${listing} and status = 'ACCEPTED'`,
    );
    expect((accepted[0] as { n: number }).n).toBe(1);
  });
});
