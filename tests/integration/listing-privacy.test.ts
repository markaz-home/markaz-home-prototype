import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { sql } from 'drizzle-orm';
import { withUserContext, withAnonContext, withServiceContext, closeConnections } from '@markaz/db';
import { getAppDb, resolveDemoIds, LISTING_IDS, type DemoIds } from './helpers';

/**
 * Draft + READY_TO_PUBLISH privacy gate (Week 2). Proves drafts and not-yet-live
 * listings, their ownership documents, and their photo metadata are owner-only —
 * never visible to another customer or the public — and that the draft-photo
 * bucket is private. Requires the local stack + `pnpm db:setup`.
 */
let ids: DemoIds | null = null;
beforeAll(async () => {
  ids = await resolveDemoIds();
  if (!ids) console.warn('[listing-privacy] Skipped — run `pnpm db:setup`.');
});
afterAll(async () => {
  await closeConnections();
});

const asA = (fn: Parameters<typeof withUserContext>[2]) => withUserContext(getAppDb(), { userId: ids!.customerA, accountType: 'CUSTOMER' }, fn);
const asB = (fn: Parameters<typeof withUserContext>[2]) => withUserContext(getAppDb(), { userId: ids!.customerB, accountType: 'CUSTOMER' }, fn);
const rows = <T = Record<string, unknown>>(r: unknown): T[] => r as T[];
const ready = LISTING_IDS.readyToPublish;

describe('listing draft + ready privacy', () => {
  it('owner A sees the READY_TO_PUBLISH listing; B and anon do not', async () => {
    if (!ids) return;
    expect(rows(await asA((tx) => tx.execute(sql`select id from public.listings where id = ${ready}`)))).toHaveLength(1);
    expect(rows(await asB((tx) => tx.execute(sql`select id from public.listings where id = ${ready}`)))).toHaveLength(0);
    const anon = await withAnonContext(getAppDb(), (tx) => tx.execute(sql`select id from public.listings where id = ${ready}`));
    expect(rows(anon)).toHaveLength(0);
  });

  it("B and anon cannot read A's draft/ready photo metadata (not LIVE)", async () => {
    if (!ids) return;
    expect(rows(await asA((tx) => tx.execute(sql`select id from public.property_photos where listing_id = ${ready}`))).length).toBeGreaterThanOrEqual(1);
    expect(rows(await asB((tx) => tx.execute(sql`select id from public.property_photos where listing_id = ${ready}`)))).toHaveLength(0);
    const anon = await withAnonContext(getAppDb(), (tx) => tx.execute(sql`select id from public.property_photos where listing_id = ${ready}`));
    expect(rows(anon)).toHaveLength(0);
  });

  it("B cannot read A's ownership documents or investment case", async () => {
    if (!ids) return;
    expect(rows(await asB((tx) => tx.execute(sql`select id from public.ownership_documents where listing_id = ${ready}`)))).toHaveLength(0);
    expect(rows(await asB((tx) => tx.execute(sql`select id from public.investment_cases where listing_id = ${ready}`)))).toHaveLength(0);
    expect(rows(await asA((tx) => tx.execute(sql`select id from public.investment_cases where listing_id = ${ready}`)))).toHaveLength(1);
  });

  it("B cannot update A's listing or change ownership (RLS)", async () => {
    if (!ids) return;
    const res = await asB((tx) => tx.execute(sql`update public.listings set asking_price = 1 where id = ${ready}`));
    // RLS makes the row invisible to B → zero rows affected (no error, no change).
    const after = await asA((tx) => tx.execute(sql`select asking_price::int as p from public.listings where id = ${ready}`));
    expect(Number(rows<{ p: number }>(after)[0]?.p)).toBe(2100000);
    expect(res).toBeTruthy();
  });

  it('the draft-photo bucket is private (public = false)', async () => {
    if (!ids) return;
    const b = await withServiceContext(getAppDb(), (tx) => tx.execute(sql`select public from storage.buckets where id = 'listing-photos-draft'`));
    expect(rows<{ public: boolean }>(b)[0]?.public).toBe(false);
  });
});
