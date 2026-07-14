/* eslint-disable no-console */
/**
 * ONE-OFF demo-account creator (for showing the buyer/seller journey without the
 * email-verification flow). Creates pre-confirmed CUSTOMER accounts via the
 * Supabase Admin API and marks their profiles onboarded so sign-in goes straight
 * to the dashboard. Safe to re-run (idempotent). Delete after the demo if desired.
 *
 *   pnpm --filter @markaz/db exec tsx src/scripts/seed-demo-customers.ts
 */
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';

// Local-first: .env.local (local stack) wins over .env (hosted), so this never writes
// to the hosted project by accident. dotenv keeps the first value per key.
for (const p of [
  resolve(process.cwd(), '../../.env.local'),
  resolve(process.cwd(), '.env.local'),
  resolve(process.cwd(), '../../.env'),
  resolve(process.cwd(), '.env'),
]) {
  if (existsSync(p)) config({ path: p });
}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const DB = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL!;
if (!URL || !KEY || !DB) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / DATABASE_URL.');
  process.exit(1);
}

const PASSWORD = 'Markaz!Demo1';
const ACCOUNTS = [
  { email: 'seller@markaz.demo', fullName: 'Aisha Al Falasi (Seller)' },
  { email: 'buyer@markaz.demo', fullName: 'Bilal Haddad (Buyer)' },
];

const admin = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });

async function findId(email: string): Promise<string | null> {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const m = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (m) return m.id;
    if (data.users.length < 200) break;
  }
  return null;
}

async function main() {
  const sql = postgres(DB, { max: 1 });
  try {
    for (const acc of ACCOUNTS) {
      const meta = { full_name: acc.fullName, terms_accepted: true, privacy_accepted: true };
      let id: string;
      const created = await admin.auth.admin.createUser({
        email: acc.email,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: meta,
      });
      if (created.data?.user) {
        id = created.data.user.id;
      } else {
        const existing = await findId(acc.email);
        if (!existing) throw created.error ?? new Error(`Could not provision ${acc.email}`);
        await admin.auth.admin.updateUserById(existing, {
          password: PASSWORD,
          email_confirm: true,
          user_metadata: meta,
        });
        id = existing;
      }
      await sql`
        insert into public.profiles
          (id, email, full_name, account_type, identity_verification_status,
           terms_accepted_at, privacy_accepted_at, onboarding_completed_at)
        values (${id}, ${acc.email}, ${acc.fullName}, 'CUSTOMER', 'VERIFIED_DEMO', now(), now(), now())
        on conflict (id) do update set
          full_name = excluded.full_name,
          identity_verification_status = 'VERIFIED_DEMO',
          onboarding_completed_at = now()`;
      console.log(`  ✓ ${acc.email}  (password: ${PASSWORD})`);
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
  console.log('✓ Demo customers ready. Sign in (do NOT sign up) with the credentials above.');
}

main().catch((e) => {
  console.error('Failed:', e);
  process.exit(1);
});
