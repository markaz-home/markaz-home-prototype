import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { sql } from 'drizzle-orm';
import { withUserContext, withAnonContext, closeConnections } from '@markaz/db';
import { getAppDb, dbAvailableAndSeeded, IDS } from './helpers';

/**
 * RLS correctness gate (§6A.3). Proves the authenticated-user-context strategy
 * and the policy matrix. Requires the local Supabase stack + seed:
 *   pnpm supabase:start && pnpm supabase:reset
 * If the DB is unreachable/unseeded the suite is skipped (CI must run the stack).
 */
let available = false;
beforeAll(async () => {
  available = await dbAvailableAndSeeded();
  if (!available) {
    // eslint-disable-next-line no-console
    console.warn('[rls.test] Skipped — local Supabase DB not reachable/seeded.');
  }
});
afterAll(async () => {
  await closeConnections();
});

const asA = <T>(fn: Parameters<typeof withUserContext>[2]) =>
  withUserContext(getAppDb(), { userId: IDS.customerA, accountType: 'CUSTOMER' }, fn) as Promise<T>;
const asB = <T>(fn: Parameters<typeof withUserContext>[2]) =>
  withUserContext(getAppDb(), { userId: IDS.customerB, accountType: 'CUSTOMER' }, fn) as Promise<T>;
const asAdmin = <T>(fn: Parameters<typeof withUserContext>[2]) =>
  withUserContext(getAppDb(), { userId: IDS.admin, accountType: 'ADMIN' }, fn) as Promise<T>;

function rows<T = Record<string, unknown>>(r: unknown): T[] {
  return r as T[];
}

describe.runIf(true)('RLS identity propagation', () => {
  it('propagates auth.uid() and runs as the authenticated role (not service-role)', async () => {
    if (!available) return;
    const r = await asA<Array<{ uid: string; role: string }>>((tx) =>
      tx.execute(sql`select auth.uid()::text as uid, current_setting('role', true) as role`),
    );
    expect(rows(r)[0]?.uid).toBe(IDS.customerA);
    expect(rows(r)[0]?.role).toBe('authenticated');
  });

  it('anonymous context is the anon role', async () => {
    if (!available) return;
    const r = await withAnonContext(getAppDb(), (tx) =>
      tx.execute(sql`select current_setting('role', true) as role`),
    );
    expect(rows<{ role: string }>(r)[0]?.role).toBe('anon');
  });

  it('Customer A reads only their own profile; cannot read Customer B', async () => {
    if (!available) return;
    const own = await asA((tx) =>
      tx.execute(sql`select id::text from public.profiles where id = ${IDS.customerA}`),
    );
    const other = await asA((tx) =>
      tx.execute(sql`select id::text from public.profiles where id = ${IDS.customerB}`),
    );
    expect(rows(own)).toHaveLength(1);
    expect(rows(other)).toHaveLength(0);
  });

  it('public/anon and other customers see only LIVE listings', async () => {
    if (!available) return;
    const anon = await withAnonContext(getAppDb(), (tx) =>
      tx.execute(sql`select count(*) filter (where state <> 'LIVE')::int as non_live from public.listings`),
    );
    expect(Number(rows<{ non_live: number }>(anon)[0]?.non_live)).toBe(0);

    // Customer B cannot see Customer A's non-LIVE (OWNERSHIP_REVIEW) listing.
    const reviewVisibleToB = await asB((tx) =>
      tx.execute(sql`select id::text from public.listings where id = ${IDS.reviewListing}`),
    );
    expect(rows(reviewVisibleToB)).toHaveLength(0);

    // The owner CAN see their own non-LIVE listing.
    const reviewVisibleToA = await asA((tx) =>
      tx.execute(sql`select id::text from public.listings where id = ${IDS.reviewListing}`),
    );
    expect(rows(reviewVisibleToA)).toHaveLength(1);
  });

  it('Admin can read all profiles and is_admin() is true', async () => {
    if (!available) return;
    const r = await asAdmin((tx) =>
      tx.execute(sql`select public.is_admin() as is_admin, (select count(*)::int from public.profiles) as n`),
    );
    expect(rows<{ is_admin: boolean; n: number }>(r)[0]?.is_admin).toBe(true);
    expect(Number(rows<{ is_admin: boolean; n: number }>(r)[0]?.n)).toBeGreaterThanOrEqual(3);
  });

  it('a customer cannot promote themselves to ADMIN', async () => {
    if (!available) return;
    await expect(
      asA((tx) =>
        tx.execute(sql`update public.profiles set account_type = 'ADMIN' where id = ${IDS.customerA}`),
      ),
    ).rejects.toBeTruthy();
    // Account type unchanged.
    const r = await asA((tx) =>
      tx.execute(sql`select account_type::text as t from public.profiles where id = ${IDS.customerA}`),
    );
    expect(rows<{ t: string }>(r)[0]?.t).toBe('CUSTOMER');
  });

  it('a customer cannot offer on a listing they own', async () => {
    if (!available) return;
    await expect(
      asA((tx) =>
        tx.execute(
          sql`insert into public.offers (listing_id, created_by, amount) values (${IDS.liveListing}, ${IDS.customerA}, 1000000)`,
        ),
      ),
    ).rejects.toBeTruthy();
  });

  it('a customer CAN offer on someone else\'s LIVE listing', async () => {
    if (!available) return;
    const inserted = await asB((tx) =>
      tx.execute(
        sql`insert into public.offers (listing_id, created_by, amount) values (${IDS.liveListing}, ${IDS.customerB}, 1234567) returning id::text`,
      ),
    );
    const id = rows<{ id: string }>(inserted)[0]?.id;
    expect(id).toBeTruthy();
    // cleanup
    if (id) {
      await asB((tx) => tx.execute(sql`delete from public.offers where id = ${id}`));
    }
  });

  it('private ownership documents are not visible to an unrelated customer', async () => {
    if (!available) return;
    const toB = await asB((tx) =>
      tx.execute(sql`select id::text from public.ownership_documents`),
    );
    expect(rows(toB)).toHaveLength(0);
    const toA = await asA((tx) =>
      tx.execute(sql`select id::text from public.ownership_documents`),
    );
    expect(rows(toA).length).toBeGreaterThanOrEqual(1);
    const toAdmin = await asAdmin((tx) =>
      tx.execute(sql`select id::text from public.ownership_documents`),
    );
    expect(rows(toAdmin).length).toBeGreaterThanOrEqual(1);
  });
});
