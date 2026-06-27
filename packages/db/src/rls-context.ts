import { sql } from 'drizzle-orm';
import type { AccountType } from '@markaz/domain';
import type { Database } from './client';

/**
 * RLS identity propagation — SELECTED STRATEGY (ADR-0004, §6A.3).
 *
 * Direct Drizzle queries do NOT inherit the authenticated Supabase user, so RLS
 * would key off the wrong identity. We therefore run every customer-scoped query
 * inside a transaction that:
 *   1. sets `request.jwt.claims` to the verified user's claims (sub = user id),
 *   2. switches to the restricted `authenticated` role via SET LOCAL ROLE,
 * so Postgres `auth.uid()` resolves to the real user and RLS evaluates correctly.
 * Both settings are transaction-local (`SET LOCAL`) and vanish at commit/rollback.
 *
 * The Supabase service-role key is NEVER used here — customer requests run as
 * `authenticated`, not as a privileged role.
 */

export interface UserContext {
  userId: string;
  email?: string;
  accountType: AccountType;
}

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

async function applyClaims(tx: Tx, role: 'authenticated' | 'anon', claims: object): Promise<void> {
  // Set claims first (custom GUC), then drop into the restricted role.
  await tx.execute(sql`select set_config('request.jwt.claims', ${JSON.stringify(claims)}, true)`);
  await tx.execute(sql`select set_config('role', ${role}, true)`);
}

/** Run customer-scoped work as the authenticated user, under RLS. */
export async function withUserContext<T>(
  db: Database,
  ctx: UserContext,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await applyClaims(tx, 'authenticated', {
      sub: ctx.userId,
      role: 'authenticated',
      email: ctx.email,
      account_type: ctx.accountType,
    });
    return fn(tx);
  });
}

/** Run work as an anonymous public visitor (sees only public LIVE data). */
export async function withAnonContext<T>(db: Database, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await applyClaims(tx, 'anon', { role: 'anon' });
    return fn(tx);
  });
}

/**
 * Run trusted server work under the connection's own (privileged) role —
 * migrations, seed, worker jobs, and explicit admin operations only.
 * Must NEVER be used for normal customer-scoped requests.
 */
export async function withServiceContext<T>(db: Database, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => fn(tx));
}

export type { Tx };
