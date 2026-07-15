/**
 * RLS correctness gate (§6A.3). Proves the authenticated-user-context strategy and
 * the policy matrix against the live local Postgres. SELF-PROVISIONS every principal
 * and listing (no demo seed) so the suite genuinely runs — it is not a no-op when the
 * seed is absent. Skips (honestly) only when the local stack is unreachable.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  asAnon,
  asAdmin,
  asUser,
  cleanup,
  closePool,
  createAdmin,
  createListing,
  createOwnershipDocument,
  createPrincipal,
  dbReachable,
  expectError,
} from './helpers/db';

const reachable = await dbReachable();
const d = reachable ? describe : describe.skip;
if (!reachable) {
  // eslint-disable-next-line no-console
  console.warn('[rls] skipped — local Postgres not reachable');
}

d('RLS identity propagation + policy matrix', () => {
  let customerA = '';
  let customerB = '';
  let admin = '';
  let aLive = ''; // LIVE listing owned by A
  let aDraft = ''; // non-LIVE (DRAFT) listing owned by A
  let bLive = ''; // LIVE listing owned by B

  beforeAll(async () => {
    customerA = await createPrincipal('rls_a');
    customerB = await createPrincipal('rls_b');
    admin = await createAdmin('rls_admin');
    aLive = await createListing(customerA, { state: 'LIVE', minNotificationPrice: 1_000_000 });
    aDraft = await createListing(customerA, { state: 'DRAFT' });
    bLive = await createListing(customerB, { state: 'LIVE', minNotificationPrice: 1_000_000 });
    await createOwnershipDocument(aLive, customerA);
  });
  afterAll(async () => {
    await cleanup();
    await closePool();
  });

  it('propagates auth.uid() and runs as the authenticated role (not service-role)', async () => {
    const r = await asUser(
      customerA,
      (tx) => tx`select auth.uid()::text as uid, current_setting('role', true) as role`,
    );
    expect((r[0] as { uid: string }).uid).toBe(customerA);
    expect((r[0] as { role: string }).role).toBe('authenticated');
  });

  it('anonymous context is the anon role', async () => {
    const r = await asAnon((tx) => tx`select current_setting('role', true) as role`);
    expect((r[0] as { role: string }).role).toBe('anon');
  });

  it('Customer A reads only their own profile; cannot read Customer B', async () => {
    const own = await asUser(
      customerA,
      (tx) => tx`select id::text from public.profiles where id = ${customerA}`,
    );
    const other = await asUser(
      customerA,
      (tx) => tx`select id::text from public.profiles where id = ${customerB}`,
    );
    expect(own.length).toBe(1);
    expect(other.length).toBe(0);
  });

  it('public/anon and other customers see only LIVE listings', async () => {
    // anon can never see ANY non-LIVE listing (global invariant).
    const anon = await asAnon(
      (tx) => tx`select count(*)::int as non_live from public.listings where state <> 'LIVE'`,
    );
    expect((anon[0] as { non_live: number }).non_live).toBe(0);

    // B cannot see A's DRAFT; A can.
    const draftToB = await asUser(
      customerB,
      (tx) => tx`select id::text from public.listings where id = ${aDraft}`,
    );
    expect(draftToB.length).toBe(0);
    const draftToA = await asUser(
      customerA,
      (tx) => tx`select id::text from public.listings where id = ${aDraft}`,
    );
    expect(draftToA.length).toBe(1);

    // A's LIVE listing is visible to anon.
    const liveToAnon = await asAnon(
      (tx) => tx`select id::text from public.listings where id = ${aLive}`,
    );
    expect(liveToAnon.length).toBe(1);
  });

  it('Admin can read all profiles and is_admin() is true', async () => {
    const r = await asAdmin(
      admin,
      (tx) =>
        tx`select public.is_admin() as is_admin, (select count(*)::int from public.profiles) as n`,
    );
    expect((r[0] as { is_admin: boolean }).is_admin).toBe(true);
    expect((r[0] as { n: number }).n).toBeGreaterThanOrEqual(3);
  });

  it('a customer cannot promote themselves to ADMIN', async () => {
    await expectError(
      () =>
        asUser(
          customerA,
          (tx) => tx`update public.profiles set account_type = 'ADMIN' where id = ${customerA}`,
        ),
      /cannot be changed|permission denied|violates|only/i,
    );
    const r = await asUser(
      customerA,
      (tx) => tx`select account_type::text as t from public.profiles where id = ${customerA}`,
    );
    expect((r[0] as { t: string }).t).toBe('CUSTOMER');
  });

  it('a customer cannot offer on a listing they own (OWN_LISTING)', async () => {
    await expectError(
      () =>
        asUser(customerA, (tx) => tx`select public.create_offer(${aLive}::uuid, 1000000, null)`),
      /OWN_LISTING/,
    );
  });

  it("a customer CAN offer on someone else's LIVE listing", async () => {
    const thread = await asUser(
      customerA,
      (tx) => tx`select id::text from public.create_offer(${bLive}::uuid, 1234567, null)`,
    );
    expect((thread[0] as { id: string }).id).toBeTruthy();
  });

  it('private ownership documents are visible only to the owner and admin', async () => {
    const toB = await asUser(
      customerB,
      (tx) => tx`select id::text from public.ownership_documents where listing_id = ${aLive}`,
    );
    expect(toB.length).toBe(0);
    const toA = await asUser(
      customerA,
      (tx) => tx`select id::text from public.ownership_documents where listing_id = ${aLive}`,
    );
    expect(toA.length).toBeGreaterThanOrEqual(1);
    const toAdmin = await asAdmin(
      admin,
      (tx) => tx`select id::text from public.ownership_documents where listing_id = ${aLive}`,
    );
    expect(toAdmin.length).toBeGreaterThanOrEqual(1);
  });
});
