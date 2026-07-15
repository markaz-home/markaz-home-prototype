/**
 * Account-provisioning + duplicate-email safety (Week 1.5). SELF-PROVISIONS its
 * principals (no demo seed): the `handle_new_user` trigger creates each profile, and
 * the Admin API rejects a duplicate email. Skips honestly only when the local
 * stack/env is unavailable.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type SupabaseClient } from '@supabase/supabase-js';
import {
  asService,
  cleanup,
  closePool,
  createAdmin,
  createNamedPrincipal,
  dbReachable,
  type Principal,
} from './helpers/db';
import { serviceClient, storageEnv } from './helpers/storage';

const env = storageEnv();
const reachable = env ? await dbReachable() : false;
const d = reachable ? describe : describe.skip;
if (!reachable) {
  // eslint-disable-next-line no-console
  console.warn('[provisioning] skipped — local Supabase stack/env not reachable');
}

d('account provisioning', () => {
  let admin: SupabaseClient;
  let customer: Principal;
  let adminId = '';

  beforeAll(async () => {
    admin = serviceClient(env!);
    customer = await createNamedPrincipal('prov_customer');
    adminId = await createAdmin('prov_admin');
  });
  afterAll(async () => {
    await cleanup();
    await closePool();
  });

  it('a self-provisioned account is CUSTOMER; the bootstrapped admin is ADMIN', async () => {
    const rows = await asService(
      (tx) =>
        tx`select id::text, account_type::text as account_type from public.profiles
           where id in (${customer.id}, ${adminId})`,
    );
    const byId = new Map(
      (rows as unknown as Array<{ id: string; account_type: string }>).map((r) => [
        r.id,
        r.account_type,
      ]),
    );
    expect(byId.get(customer.id)).toBe('CUSTOMER');
    expect(byId.get(adminId)).toBe('ADMIN');
  });

  it('signing up an existing email does not create a second profile', async () => {
    // Admin API createUser for an existing email must fail (no duplicate Auth user).
    const { error } = await admin.auth.admin.createUser({
      email: customer.email,
      password: 'Another!Pass1',
      email_confirm: true,
    });
    expect(error).toBeTruthy();
    const rows = await asService(
      (tx) => tx`select count(*)::int as n from public.profiles where email = ${customer.email}`,
    );
    expect((rows[0] as { n: number }).n).toBe(1);
  });

  it('every profile maps 1:1 to an auth user (no orphans)', async () => {
    const rows = await asService(
      (tx) =>
        tx`select count(*)::int as orphans from public.profiles p
           left join auth.users u on u.id = p.id where u.id is null`,
    );
    expect((rows[0] as { orphans: number }).orphans).toBe(0);
  });
});
