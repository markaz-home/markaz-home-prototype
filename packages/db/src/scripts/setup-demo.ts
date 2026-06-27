/* eslint-disable no-console */
/**
 * Idempotent demo provisioning (Week 1.5, ADR-0009).
 *
 * Creates the three demo accounts through the SUPPORTED Supabase Admin API
 * (email/password, email pre-confirmed) — NOT by writing Auth tables in SQL —
 * then promotes the admin, marks demo identity verified, and seeds demo domain
 * data via the direct DB connection. Server-only; refuses to run in production.
 *
 * Run AFTER `pnpm supabase:reset`:  pnpm db:setup
 */
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';

for (const p of [resolve(process.cwd(), '../../.env'), resolve(process.cwd(), '.env')]) {
  if (existsSync(p)) config({ path: p });
}

function fail(msg: string): never {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

const demoEnv = (process.env.DEMO_ENVIRONMENT ?? 'local').toLowerCase();
if (demoEnv === 'production' || process.env.NODE_ENV === 'production') {
  fail('Refusing to run demo setup: this is a non-production-only script.');
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DB_URL = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
if (!SUPABASE_URL || !SERVICE_KEY || !DB_URL) {
  fail('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / DATABASE_URL. See .env.example.');
}

interface DemoAccount {
  email: string;
  fullName: string;
  admin: boolean;
  passwordEnv: string;
  defaultPassword: string;
}

const ACCOUNTS: DemoAccount[] = [
  { email: 'customer-a@markaz.demo', fullName: 'Aisha Al Falasi (Demo Seller)', admin: false, passwordEnv: 'DEMO_CUSTOMER_A_PASSWORD', defaultPassword: 'Markaz!Demo1' },
  { email: 'customer-b@markaz.demo', fullName: 'Bilal Haddad (Demo Buyer)', admin: false, passwordEnv: 'DEMO_CUSTOMER_B_PASSWORD', defaultPassword: 'Markaz!Demo1' },
  { email: 'admin@markaz.demo', fullName: 'MARKAZ Operations (Demo Admin)', admin: true, passwordEnv: 'DEMO_ADMIN_PASSWORD', defaultPassword: 'Markaz!Admin1' },
];

const admin = createClient(SUPABASE_URL!, SERVICE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function findUserIdByEmail(email: string): Promise<string | null> {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (match) return match.id;
    if (data.users.length < 200) break;
  }
  return null;
}

async function ensureUser(acc: DemoAccount): Promise<string> {
  const password = process.env[acc.passwordEnv] ?? acc.defaultPassword;
  const user_metadata = { full_name: acc.fullName, terms_accepted: true, privacy_accepted: true };

  const { data, error } = await admin.auth.admin.createUser({
    email: acc.email,
    password,
    email_confirm: true,
    user_metadata,
  });
  if (data?.user) return data.user.id;

  // Already exists → make idempotent: reset password + metadata, keep confirmed.
  const id = await findUserIdByEmail(acc.email);
  if (!id) throw error ?? new Error(`Could not provision ${acc.email}`);
  const upd = await admin.auth.admin.updateUserById(id, { password, email_confirm: true, user_metadata });
  if (upd.error) throw upd.error;
  return id;
}

async function main() {
  console.log(`→ Provisioning demo accounts via the Supabase Admin API (env: ${demoEnv})`);
  const ids: Record<string, string> = {};
  for (const acc of ACCOUNTS) {
    ids[acc.email] = await ensureUser(acc);
    console.log(`  ✓ ${acc.email}`);
  }
  const idA = ids['customer-a@markaz.demo']!;
  const idB = ids['customer-b@markaz.demo']!;

  const sql = postgres(DB_URL!, { max: 1 });
  try {
    // Upsert each demo profile explicitly (don't rely solely on the signup
    // trigger — Admin-API users created before the table existed would be
    // orphaned). Idempotent; both customers return demo-verified, admin promoted.
    for (const acc of ACCOUNTS) {
      const id = ids[acc.email]!;
      const accountType = acc.admin ? 'ADMIN' : 'CUSTOMER';
      await sql`
        insert into public.profiles
          (id, email, full_name, account_type, identity_verification_status,
           terms_accepted_at, privacy_accepted_at, onboarding_completed_at)
        values (${id}, ${acc.email}, ${acc.fullName}, ${accountType}, 'VERIFIED_DEMO',
                now(), now(), now())
        on conflict (id) do update set
          full_name = excluded.full_name,
          account_type = excluded.account_type,
          identity_verification_status = excluded.identity_verification_status,
          terms_accepted_at = excluded.terms_accepted_at,
          privacy_accepted_at = excluded.privacy_accepted_at,
          onboarding_completed_at = excluded.onboarding_completed_at`;
    }

    // --- Demo domain data (fictional; idempotent via fixed ids) --------------
    await sql`
      insert into public.properties (id, owner_id, emirate, community, address_line, property_type, bedrooms, size_sqft) values
        ('00000000-0000-0000-0000-0000000010a1', ${idA}, 'Dubai', 'Dubai Marina', 'Marina Gate, Tower 1', 'Apartment', 2, 1180.00),
        ('00000000-0000-0000-0000-0000000010a2', ${idA}, 'Dubai', 'Downtown Dubai', 'Burj Vista', 'Apartment', 1, 820.00),
        ('00000000-0000-0000-0000-0000000010a3', ${idA}, 'Dubai', 'Arabian Ranches', 'Palmera 2', 'Villa', 3, 2400.00)
      on conflict (id) do nothing`;

    await sql`
      insert into public.listings (id, property_id, owner_id, title, state, currency, asking_price, min_notification_price, published_at) values
        ('00000000-0000-0000-0000-0000000020a1', '00000000-0000-0000-0000-0000000010a1', ${idA}, 'Bright 2-bed in Dubai Marina (Demo)', 'LIVE', 'AED', 2650000, 2400000, now()),
        ('00000000-0000-0000-0000-0000000020a2', '00000000-0000-0000-0000-0000000010a2', ${idA}, 'Downtown 1-bed with Burj view (Demo)', 'LIVE', 'AED', 1950000, 1800000, now()),
        ('00000000-0000-0000-0000-0000000020a3', '00000000-0000-0000-0000-0000000010a3', ${idA}, 'Arabian Ranches 3-bed villa (Demo)', 'OWNERSHIP_REVIEW', 'AED', 5200000, 4900000, null)
      on conflict (id) do nothing`;

    await sql`
      insert into public.property_photos (id, listing_id, storage_path, is_cover, sort_order) values
        ('00000000-0000-0000-0000-0000000030a1', '00000000-0000-0000-0000-0000000020a1', 'listing-photos/demo/marina-cover.jpg', true, 0),
        ('00000000-0000-0000-0000-0000000030a2', '00000000-0000-0000-0000-0000000020a2', 'listing-photos/demo/downtown-cover.jpg', true, 0)
      on conflict (id) do nothing`;

    await sql`
      insert into public.ownership_documents (id, listing_id, owner_id, document_type, storage_path, status) values
        ('00000000-0000-0000-0000-0000000040a1', '00000000-0000-0000-0000-0000000020a3', ${idA}, 'TITLE_DEED', 'ownership-documents/demo/title-deed-sample.pdf', 'PENDING')
      on conflict (id) do nothing`;

    // Offers: Customer B on Customer A's listings (never on one's own).
    await sql`
      insert into public.offers (id, listing_id, created_by, amount, state, below_threshold, expires_at) values
        ('00000000-0000-0000-0000-0000000050b1', '00000000-0000-0000-0000-0000000020a1', ${idB}, 2500000, 'UNDER_REVIEW', false, now() + interval '48 hours'),
        ('00000000-0000-0000-0000-0000000050b2', '00000000-0000-0000-0000-0000000020a2', ${idB}, 1500000, 'SUBMITTED', true, now() + interval '48 hours')
      on conflict (id) do nothing`;

    await sql`
      insert into public.transactions (id, offer_id, listing_id, buyer_id, seller_id, stage, flagged) values
        ('00000000-0000-0000-0000-0000000060c1', null, '00000000-0000-0000-0000-0000000020a2', ${idB}, ${idA}, 'MOU', false)
      on conflict (id) do nothing`;

    await sql`
      insert into public.transaction_stage_history (transaction_id, stage, note)
      select '00000000-0000-0000-0000-0000000060c1', 'ACCEPTANCE', 'Demo: offer accepted as preferred'
      where not exists (select 1 from public.transaction_stage_history where transaction_id = '00000000-0000-0000-0000-0000000060c1')`;

    await sql`
      insert into public.notifications (recipient_id, channel, kind, payload)
      select ${idA}, 'IN_APP', 'OFFER_RECEIVED', '{"listing":"Dubai Marina"}'::jsonb
      where not exists (select 1 from public.notifications where recipient_id = ${idA} and kind = 'OFFER_RECEIVED')`;

    console.log('  ✓ Demo domain data seeded');
  } finally {
    await sql.end({ timeout: 5 });
  }

  console.log('✓ Demo setup complete. Sign in with the demo credentials (see docs/runbooks/demo-runbook.md).');
}

main().catch((err) => {
  console.error('Demo setup failed:', err);
  process.exit(1);
});
