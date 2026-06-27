import postgres from 'postgres';
import { getDirectDb, getAppDb } from '@markaz/db';

/** Demo accounts are provisioned by `pnpm db:setup` (Admin API → random UUIDs). */
export const DEMO_EMAILS = {
  customerA: 'customer-a@markaz.demo',
  customerB: 'customer-b@markaz.demo',
  admin: 'admin@markaz.demo',
} as const;

/** Domain demo rows use fixed ids (the setup script inserts them). */
export const LISTING_IDS = {
  live: '00000000-0000-0000-0000-0000000020a1',
  review: '00000000-0000-0000-0000-0000000020a3',
} as const;

export interface DemoIds {
  customerA: string;
  customerB: string;
  admin: string;
}

function dbUrl(): string {
  return (
    process.env.DIRECT_DATABASE_URL ??
    process.env.DATABASE_URL ??
    'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
  );
}

/**
 * Resolve demo profile ids by email (as the unrestricted postgres role), or null
 * if the stack is unreachable or `pnpm db:setup` hasn't run.
 */
export async function resolveDemoIds(): Promise<DemoIds | null> {
  const sql = postgres(dbUrl(), { max: 1, connect_timeout: 3 });
  try {
    const rows = await sql<{ email: string; id: string }[]>`
      select email, id::text as id from public.profiles
      where email in (${DEMO_EMAILS.customerA}, ${DEMO_EMAILS.customerB}, ${DEMO_EMAILS.admin})`;
    const byEmail = new Map(rows.map((r) => [r.email, r.id]));
    const a = byEmail.get(DEMO_EMAILS.customerA);
    const b = byEmail.get(DEMO_EMAILS.customerB);
    const admin = byEmail.get(DEMO_EMAILS.admin);
    if (!a || !b || !admin) return null;
    return { customerA: a, customerB: b, admin };
  } catch {
    return null;
  } finally {
    await sql.end({ timeout: 1 });
  }
}

export { getDirectDb, getAppDb };
