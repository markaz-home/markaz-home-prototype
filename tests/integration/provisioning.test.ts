import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { DEMO_EMAILS } from './helpers';

/**
 * Account-provisioning + duplicate-email safety (Week 1.5).
 * Requires the local stack + `pnpm db:setup`. Self-skips otherwise.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dbUrl =
  process.env.DIRECT_DATABASE_URL ??
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

let available = false;
let admin: SupabaseClient | null = null;
const sql = postgres(dbUrl, { max: 1, connect_timeout: 3 });

beforeAll(async () => {
  if (!url || !serviceKey) return;
  admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  try {
    const rows = await sql<{ n: number }[]>`select count(*)::int as n from public.profiles where email = ${DEMO_EMAILS.admin}`;
    available = Number(rows[0]?.n ?? 0) > 0;
  } catch {
    available = false;
  }
});
afterAll(async () => {
  await sql.end({ timeout: 2 });
});

describe('account provisioning', () => {
  it('the admin is provisioned as ADMIN; customers as CUSTOMER', async () => {
    if (!available) return;
    const rows = await sql<{ email: string; account_type: string }[]>`
      select email, account_type::text as account_type from public.profiles
      where email in (${DEMO_EMAILS.customerA}, ${DEMO_EMAILS.customerB}, ${DEMO_EMAILS.admin})`;
    const byEmail = new Map(rows.map((r) => [r.email, r.account_type]));
    expect(byEmail.get(DEMO_EMAILS.customerA)).toBe('CUSTOMER');
    expect(byEmail.get(DEMO_EMAILS.customerB)).toBe('CUSTOMER');
    expect(byEmail.get(DEMO_EMAILS.admin)).toBe('ADMIN');
  });

  it('signing up an existing email does not create a second profile', async () => {
    if (!available || !admin) return;
    // Admin API createUser for an existing email must fail (no duplicate Auth user).
    const { error } = await admin.auth.admin.createUser({
      email: DEMO_EMAILS.customerA,
      password: 'Another!Pass1',
      email_confirm: true,
    });
    expect(error).toBeTruthy();
    // And exactly one profile remains for that email.
    const rows = await sql<{ n: number }[]>`select count(*)::int as n from public.profiles where email = ${DEMO_EMAILS.customerA}`;
    expect(Number(rows[0]?.n)).toBe(1);
  });

  it('every profile maps 1:1 to an auth user (idempotent creation)', async () => {
    if (!available) return;
    const rows = await sql<{ orphans: number }[]>`
      select count(*)::int as orphans from public.profiles p
      left join auth.users u on u.id = p.id where u.id is null`;
    expect(Number(rows[0]?.orphans)).toBe(0);
  });
});
