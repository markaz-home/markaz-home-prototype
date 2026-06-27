import postgres from 'postgres';
import { getDirectDb, getAppDb } from '@markaz/db';

/** Seeded demo account ids (supabase/seed.sql). */
export const IDS = {
  customerA: '00000000-0000-0000-0000-00000000000a',
  customerB: '00000000-0000-0000-0000-00000000000b',
  admin: '00000000-0000-0000-0000-0000000000ad',
  liveListing: '00000000-0000-0000-0000-0000000020a1',
  reviewListing: '00000000-0000-0000-0000-0000000020a3',
} as const;

/** Returns true if the local DB is reachable AND seeded (so the suite can run). */
export async function dbAvailableAndSeeded(): Promise<boolean> {
  const url =
    process.env.DIRECT_DATABASE_URL ??
    process.env.DATABASE_URL ??
    'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
  const probe = postgres(url, { max: 1, connect_timeout: 3 });
  try {
    const rows = await probe`select count(*)::int as n from public.profiles where id = ${IDS.admin}`;
    return Number(rows[0]?.n ?? 0) > 0;
  } catch {
    return false;
  } finally {
    await probe.end({ timeout: 1 });
  }
}

export { getDirectDb, getAppDb };
