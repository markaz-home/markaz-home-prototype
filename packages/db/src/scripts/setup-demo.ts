/* eslint-disable no-console */
/**
 * Optional admin bootstrap (ADR-0009).
 *
 * Real customers sign up through the app (email + password + verification); the
 * `handle_new_user` trigger creates their `profiles` row automatically — so a
 * deployed prototype needs NO seeded accounts. This script creates only an
 * ADMIN, and only when you explicitly ask for one, because admins can never
 * self-sign-up (no public admin sign-up — hard product rule).
 *
 * Provide the admin via env, then run `pnpm db:setup`:
 *   BOOTSTRAP_ADMIN_EMAIL=you@example.com BOOTSTRAP_ADMIN_PASSWORD='…' pnpm db:setup
 * With no BOOTSTRAP_ADMIN_EMAIL set, the script is a no-op (nothing is seeded).
 *
 * Uses the SUPPORTED Supabase Admin API (email pre-confirmed) — never writes Auth
 * tables in SQL — then upserts the admin profile via the direct DB connection.
 * Idempotent.
 */
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';

// Local-first: .env.local (local stack) wins over .env (hosted deploy contract), so
// running this locally targets your LOCAL DB — never the hosted project by accident.
// dotenv keeps the first value per key, so load .env.local before .env.
for (const p of [
  resolve(process.cwd(), '../../.env.local'),
  resolve(process.cwd(), '.env.local'),
  resolve(process.cwd(), '../../.env'),
  resolve(process.cwd(), '.env'),
]) {
  if (existsSync(p)) config({ path: p });
}

function fail(msg: string): never {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DB_URL = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;

// Only the BOOTSTRAP_ADMIN_* contract — the legacy DEMO_ADMIN_* fallbacks were removed
// (review #5) so there is one explicit, unambiguous way to bootstrap the admin.
const ADMIN_EMAIL = process.env.BOOTSTRAP_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.BOOTSTRAP_ADMIN_PASSWORD;
const ADMIN_NAME = process.env.BOOTSTRAP_ADMIN_NAME ?? 'MARKAZ Operations';

async function main() {
  if (!ADMIN_EMAIL) {
    console.log(
      '→ No admin to bootstrap (BOOTSTRAP_ADMIN_EMAIL not set). Nothing seeded — ' +
        'customers sign up through the app. Set BOOTSTRAP_ADMIN_EMAIL + ' +
        'BOOTSTRAP_ADMIN_PASSWORD to create an admin.',
    );
    return;
  }
  if (!ADMIN_PASSWORD) fail('BOOTSTRAP_ADMIN_EMAIL set but BOOTSTRAP_ADMIN_PASSWORD is missing.');
  if (!SUPABASE_URL || !SERVICE_KEY || !DB_URL) {
    fail(
      'Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / DATABASE_URL. See .env.example.',
    );
  }

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

  console.log(`→ Bootstrapping admin ${ADMIN_EMAIL} via the Supabase Admin API`);
  const user_metadata = { full_name: ADMIN_NAME, terms_accepted: true, privacy_accepted: true };
  let id: string;
  const created = await admin.auth.admin.createUser({
    email: ADMIN_EMAIL!,
    password: ADMIN_PASSWORD!,
    email_confirm: true,
    user_metadata,
  });
  if (created.data?.user) {
    id = created.data.user.id;
  } else {
    // Already exists → idempotent: reset password + metadata, keep confirmed.
    const existing = await findUserIdByEmail(ADMIN_EMAIL!);
    if (!existing) throw created.error ?? new Error(`Could not provision ${ADMIN_EMAIL}`);
    const upd = await admin.auth.admin.updateUserById(existing, {
      password: ADMIN_PASSWORD!,
      email_confirm: true,
      user_metadata,
    });
    if (upd.error) throw upd.error;
    id = existing;
  }

  const sql = postgres(DB_URL!, { max: 1 });
  try {
    // Promote to ADMIN. Idempotent. (Customers are never seeded — they sign up.)
    await sql`
      insert into public.profiles
        (id, email, full_name, account_type, identity_verification_status,
         terms_accepted_at, privacy_accepted_at, onboarding_completed_at)
      values (${id}, ${ADMIN_EMAIL}, ${ADMIN_NAME}, 'ADMIN', 'VERIFIED_DEMO',
              now(), now(), now())
      on conflict (id) do update set
        full_name = excluded.full_name,
        account_type = excluded.account_type,
        identity_verification_status = excluded.identity_verification_status,
        terms_accepted_at = excluded.terms_accepted_at,
        privacy_accepted_at = excluded.privacy_accepted_at,
        onboarding_completed_at = excluded.onboarding_completed_at`;
  } finally {
    await sql.end({ timeout: 5 });
  }

  console.log(`✓ Admin ready: ${ADMIN_EMAIL}. Sign in at the admin app.`);
}

main().catch((err) => {
  console.error('Admin bootstrap failed:', err);
  process.exit(1);
});
