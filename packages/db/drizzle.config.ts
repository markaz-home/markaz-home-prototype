import { defineConfig } from 'drizzle-kit';

/**
 * Drizzle is the typed schema + query layer (§6A.4). `drizzle-kit generate`
 * writes diff SQL into ./drizzle for REVIEW; reviewed SQL is then folded into
 * the single canonical history at supabase/migrations. drizzle-kit never
 * applies migrations directly.
 */
export default defineConfig({
  schema: './src/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url:
      process.env.DIRECT_DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
  },
  schemaFilter: ['public'],
  verbose: true,
  strict: true,
});
