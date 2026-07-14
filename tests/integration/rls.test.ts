import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { sql } from 'drizzle-orm';
import { withUserContext, withAnonContext, closeConnections } from '@markaz/db';
import { getAppDb, resolveDemoIds, LISTING_IDS, type DemoIds } from './helpers';

/**
 * RLS correctness gate (§6A.3). Proves the authenticated-user-context strategy
 * and the policy matrix. Requires the local stack + demo provisioning:
 *   pnpm supabase:start && pnpm supabase:reset && pnpm db:setup
 * If the DB is unreachable / demo accounts are missing, the suite is skipped.
 */
let ids: DemoIds | null = null;
beforeAll(async () => {
  ids = await resolveDemoIds();
  if (!ids) {
    // eslint-disable-next-line no-console
    console.warn('[rls.test] Skipped — demo accounts not provisioned (run `pnpm db:setup`).');
  }
});
afterAll(async () => {
  await closeConnections();
});

const asA = <T>(fn: Parameters<typeof withUserContext>[2]) =>
  withUserContext(
    getAppDb(),
    { userId: ids!.customerA, accountType: 'CUSTOMER' },
    fn,
  ) as Promise<T>;
const asB = <T>(fn: Parameters<typeof withUserContext>[2]) =>
  withUserContext(
    getAppDb(),
    { userId: ids!.customerB, accountType: 'CUSTOMER' },
    fn,
  ) as Promise<T>;
const asAdmin = <T>(fn: Parameters<typeof withUserContext>[2]) =>
  withUserContext(getAppDb(), { userId: ids!.admin, accountType: 'ADMIN' }, fn) as Promise<T>;

function rows<T = Record<string, unknown>>(r: unknown): T[] {
  return r as T[];
}

describe('RLS identity propagation', () => {
  it('propagates auth.uid() and runs as the authenticated role (not service-role)', async () => {
    if (!ids) return;
    const r = await asA<Array<{ uid: string; role: string }>>((tx) =>
      tx.execute(sql`select auth.uid()::text as uid, current_setting('role', true) as role`),
    );
    expect(rows(r)[0]?.uid).toBe(ids.customerA);
    expect(rows(r)[0]?.role).toBe('authenticated');
  });

  it('anonymous context is the anon role', async () => {
    if (!ids) return;
    const r = await withAnonContext(getAppDb(), (tx) =>
      tx.execute(sql`select current_setting('role', true) as role`),
    );
    expect(rows<{ role: string }>(r)[0]?.role).toBe('anon');
  });

  it('Customer A reads only their own profile; cannot read Customer B', async () => {
    if (!ids) return;
    const own = await asA((tx) =>
      tx.execute(sql`select id::text from public.profiles where id = ${ids!.customerA}`),
    );
    const other = await asA((tx) =>
      tx.execute(sql`select id::text from public.profiles where id = ${ids!.customerB}`),
    );
    expect(rows(own)).toHaveLength(1);
    expect(rows(other)).toHaveLength(0);
  });

  it('public/anon and other customers see only LIVE listings', async () => {
    if (!ids) return;
    const anon = await withAnonContext(getAppDb(), (tx) =>
      tx.execute(
        sql`select count(*) filter (where state <> 'LIVE')::int as non_live from public.listings`,
      ),
    );
    expect(Number(rows<{ non_live: number }>(anon)[0]?.non_live)).toBe(0);

    const reviewVisibleToB = await asB((tx) =>
      tx.execute(sql`select id::text from public.listings where id = ${LISTING_IDS.review}`),
    );
    expect(rows(reviewVisibleToB)).toHaveLength(0);

    const reviewVisibleToA = await asA((tx) =>
      tx.execute(sql`select id::text from public.listings where id = ${LISTING_IDS.review}`),
    );
    expect(rows(reviewVisibleToA)).toHaveLength(1);
  });

  it('Admin can read all profiles and is_admin() is true', async () => {
    if (!ids) return;
    const r = await asAdmin((tx) =>
      tx.execute(
        sql`select public.is_admin() as is_admin, (select count(*)::int from public.profiles) as n`,
      ),
    );
    expect(rows<{ is_admin: boolean; n: number }>(r)[0]?.is_admin).toBe(true);
    expect(Number(rows<{ is_admin: boolean; n: number }>(r)[0]?.n)).toBeGreaterThanOrEqual(3);
  });

  it('a customer cannot promote themselves to ADMIN', async () => {
    if (!ids) return;
    await expect(
      asA((tx) =>
        tx.execute(
          sql`update public.profiles set account_type = 'ADMIN' where id = ${ids!.customerA}`,
        ),
      ),
    ).rejects.toBeTruthy();
    const r = await asA((tx) =>
      tx.execute(
        sql`select account_type::text as t from public.profiles where id = ${ids!.customerA}`,
      ),
    );
    expect(rows<{ t: string }>(r)[0]?.t).toBe('CUSTOMER');
  });

  it('a customer cannot offer on a listing they own', async () => {
    if (!ids) return;
    await expect(
      asA((tx) =>
        tx.execute(
          sql`insert into public.offers (listing_id, created_by, amount) values (${LISTING_IDS.live}, ${ids!.customerA}, 1000000)`,
        ),
      ),
    ).rejects.toBeTruthy();
  });

  it("a customer CAN offer on someone else's LIVE listing", async () => {
    if (!ids) return;
    const inserted = await asB((tx) =>
      tx.execute(
        sql`insert into public.offers (listing_id, created_by, amount) values (${LISTING_IDS.live}, ${ids!.customerB}, 1234567) returning id::text`,
      ),
    );
    const id = rows<{ id: string }>(inserted)[0]?.id;
    expect(id).toBeTruthy();
    if (id) await asB((tx) => tx.execute(sql`delete from public.offers where id = ${id}`));
  });

  it('private ownership documents are not visible to an unrelated customer', async () => {
    if (!ids) return;
    const toB = await asB((tx) => tx.execute(sql`select id::text from public.ownership_documents`));
    expect(rows(toB)).toHaveLength(0);
    const toA = await asA((tx) => tx.execute(sql`select id::text from public.ownership_documents`));
    expect(rows(toA).length).toBeGreaterThanOrEqual(1);
    const toAdmin = await asAdmin((tx) =>
      tx.execute(sql`select id::text from public.ownership_documents`),
    );
    expect(rows(toAdmin).length).toBeGreaterThanOrEqual(1);
  });
});
