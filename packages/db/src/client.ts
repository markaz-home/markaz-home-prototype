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
let appClient: ReturnType<typeof postgres> | undefined;
let directClient: ReturnType<typeof postgres> | undefined;
let appDb: Database | undefined;
let directDb: Database | undefined;

function connectionString(kind: 'app' | 'direct'): string {
  const url =
    kind === 'direct'
      ? process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL
      : process.env.DATABASE_URL ?? process.env.DIRECT_DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL / DIRECT_DATABASE_URL is not set. Copy .env.example to .env and run `pnpm supabase:start`.',
    );
  }
  return url;
}

/** Pooled connection for customer-scoped queries (used with withUserContext). */
export function getAppDb(): Database {
  if (!appDb) {
    appClient = postgres(connectionString('app'), { max: 10, prepare: false });
    appDb = drizzle(appClient, { schema });
  }
  return appDb;
}

/** Direct connection for trusted server operations (migrations/seed/worker/admin). */
export function getDirectDb(): Database {
  if (!directDb) {
    directClient = postgres(connectionString('direct'), { max: 5 });
    directDb = drizzle(directClient, { schema });
  }
  return directDb;
}

/** Create a one-off client (used by the seed runner and tests). */
export function createClient(url: string, opts: postgres.Options<Record<string, never>> = {}) {
  const client = postgres(url, { max: 1, ...opts });
  return { client, db: drizzle(client, { schema }) as Database };
}

export async function closeConnections(): Promise<void> {
  await Promise.all([appClient?.end(), directClient?.end()]);
  appClient = directClient = undefined;
  appDb = directDb = undefined;
}
