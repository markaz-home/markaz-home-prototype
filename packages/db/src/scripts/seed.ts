import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import postgres from 'postgres';

/**
 * Re-runs the canonical seed (supabase/seed.sql) against DIRECT_DATABASE_URL.
 * For a full clean reset (migrations + seed) prefer `pnpm supabase:reset`.
 */
async function main() {
  const candidates = [
    resolve(process.cwd(), 'supabase/seed.sql'),
    resolve(process.cwd(), '../../supabase/seed.sql'),
  ];
  const seedPath = candidates.find(existsSync);
  if (!seedPath) {
    throw new Error(`Could not locate supabase/seed.sql (looked in: ${candidates.join(', ')})`);
  }

  const url =
    process.env.DIRECT_DATABASE_URL ??
    process.env.DATABASE_URL ??
    'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

  const sqlText = readFileSync(seedPath, 'utf8');
  const client = postgres(url, { max: 1 });
  try {
    await client.unsafe(sqlText);
    // eslint-disable-next-line no-console
    console.log(`✓ Seed applied from ${seedPath}`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
