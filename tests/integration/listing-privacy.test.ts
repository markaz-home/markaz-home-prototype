/**
 * Draft + READY_TO_PUBLISH privacy gate (Week 2). Proves drafts and not-yet-live
 * listings, their ownership documents, and their photo metadata are owner-only —
 * never visible to another customer or the public — and that the draft-photo bucket
 * is private. SELF-PROVISIONS its owner + fixtures (no demo seed). Skips honestly
 * only when the local Postgres is unreachable.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  asAnon,
  asService,
  asUser,
  cleanup,
  closePool,
  createInvestmentCase,
  createListing,
  createOwnershipDocument,
  createPhoto,
  createPrincipal,
  dbReachable,
} from './helpers/db';

const reachable = await dbReachable();
const d = reachable ? describe : describe.skip;
if (!reachable) {
  // eslint-disable-next-line no-console
  console.warn('[listing-privacy] skipped — local Postgres not reachable');
}

const ASKING = 2_100_000;

d('listing draft + ready privacy', () => {
  let customerA = '';
  let customerB = '';
  let ready = ''; // READY_TO_PUBLISH listing owned by A, with photo + doc + investment case

  beforeAll(async () => {
    customerA = await createPrincipal('priv_a');
    customerB = await createPrincipal('priv_b');
    ready = await createListing(customerA, { state: 'READY_TO_PUBLISH', askingPrice: ASKING });
    await createPhoto(ready, { storagePath: `${customerA}/${ready}/p1.jpg` });
    await createOwnershipDocument(ready, customerA);
    await createInvestmentCase(ready, { visible: true });
  });
  afterAll(async () => {
    await cleanup();
    await closePool();
  });

  it('owner A sees the READY_TO_PUBLISH listing; B and anon do not', async () => {
    expect(
      (await asUser(customerA, (tx) => tx`select id from public.listings where id = ${ready}`))
        .length,
    ).toBe(1);
    expect(
      (await asUser(customerB, (tx) => tx`select id from public.listings where id = ${ready}`))
        .length,
    ).toBe(0);
    expect(
      (await asAnon((tx) => tx`select id from public.listings where id = ${ready}`)).length,
    ).toBe(0);
  });

  it("B and anon cannot read A's draft/ready photo metadata (not LIVE)", async () => {
    expect(
      (
        await asUser(
          customerA,
          (tx) => tx`select id from public.property_photos where listing_id = ${ready}`,
        )
      ).length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      (
        await asUser(
          customerB,
          (tx) => tx`select id from public.property_photos where listing_id = ${ready}`,
        )
      ).length,
    ).toBe(0);
    expect(
      (await asAnon((tx) => tx`select id from public.property_photos where listing_id = ${ready}`))
        .length,
    ).toBe(0);
  });

  it("B cannot read A's ownership documents or investment case; A can", async () => {
    expect(
      (
        await asUser(
          customerB,
          (tx) => tx`select id from public.ownership_documents where listing_id = ${ready}`,
        )
      ).length,
    ).toBe(0);
    expect(
      (
        await asUser(
          customerB,
          (tx) => tx`select id from public.investment_cases where listing_id = ${ready}`,
        )
      ).length,
    ).toBe(0);
    expect(
      (
        await asUser(
          customerA,
          (tx) => tx`select id from public.investment_cases where listing_id = ${ready}`,
        )
      ).length,
    ).toBe(1);
  });

  it("B cannot update A's listing (RLS makes the row invisible → no change)", async () => {
    // RLS filters the row out for B → zero rows affected, no error, no change.
    await asUser(
      customerB,
      (tx) => tx`update public.listings set asking_price = 1 where id = ${ready}`,
    );
    const after = await asUser(
      customerA,
      (tx) => tx`select asking_price::int as p from public.listings where id = ${ready}`,
    );
    expect((after[0] as { p: number }).p).toBe(ASKING);
  });

  it('the draft-photo bucket is private (public = false)', async () => {
    const b = await asService(
      (tx) => tx`select public from storage.buckets where id = 'listing-photos-draft'`,
    );
    expect((b[0] as { public: boolean }).public).toBe(false);
  });
});
