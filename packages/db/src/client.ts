import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { schema } from './schema';

export type Database = PostgresJsDatabase<typeof schema>;

/**
 * Two connection roles by design (§6A.2):
 *  - app:    pooled, for customer-scoped tRPC queries (runs under `authenticated`
 *            via the RLS-context helper). In production this is RDS Proxy.
 *  - direct: unpooled, for migrations / admin / worker ops. In production this is
 *            the direct RDS endpoint (Realtime + migrations never use a pooler).
 */
/**
 * Cache the clients on globalThis so Next.js dev hot-reloads reuse ONE pool
 * instead of leaking a new pool on every module re-evaluation (which exhausts a
 * Supabase pooler's connection cap). Production creates them once anyway.
 */
const g = globalThis as unknown as {
  __markazAppClient?: ReturnType<typeof postgres>;
  __markazDirectClient?: ReturnType<typeof postgres>;
  __markazAppDb?: Database;
  __markazDirectDb?: Database;
};

function connectionString(kind: 'app' | 'direct'): string {
  const url =
    kind === 'direct'
      ? (process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL)
      : (process.env.DATABASE_URL ?? process.env.DIRECT_DATABASE_URL);
  if (!url) {
    throw new Error(
      'DATABASE_URL / DIRECT_DATABASE_URL is not set. Copy .env.example to .env and run `pnpm supabase:start`.',
    );
  }
  return url;
}

/** Pooled connection for customer-scoped queries (used with withUserContext). */
export function getAppDb(): Database {
  if (!g.__markazAppDb) {
    // Small pool + prepare:false works behind a Supabase transaction/session pooler.
    g.__markazAppClient = postgres(connectionString('app'), {
      max: 5,
      prepare: false,
      idle_timeout: 20,
    });
    g.__markazAppDb = drizzle(g.__markazAppClient, { schema });
  }
  return g.__markazAppDb;
}

/** Direct connection for trusted server operations (migrations/seed/worker/admin). */
export function getDirectDb(): Database {
  if (!g.__markazDirectDb) {
    g.__markazDirectClient = postgres(connectionString('direct'), { max: 2, idle_timeout: 20 });
    g.__markazDirectDb = drizzle(g.__markazDirectClient, { schema });
  }
  return g.__markazDirectDb;
}

/** Create a one-off client (used by the seed runner and tests). */
export function createClient(url: string, opts: postgres.Options<Record<string, never>> = {}) {
  const client = postgres(url, { max: 1, ...opts });
  return { client, db: drizzle(client, { schema }) as Database };
}

export async function closeConnections(): Promise<void> {
  await Promise.all([g.__markazAppClient?.end(), g.__markazDirectClient?.end()]);
  g.__markazAppClient = g.__markazDirectClient = undefined;
  g.__markazAppDb = g.__markazDirectDb = undefined;
}
