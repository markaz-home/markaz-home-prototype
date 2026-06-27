# Runbook: Database Migrations, Seed, and Reset

The database is rebuilt from a **single ordered SQL history** in
`supabase/migrations/`, followed by `supabase/seed.sql` (ADR 0003).

## Commands

| Command | What it does | When to use |
| --- | --- | --- |
| `pnpm supabase:reset` | Drops the DB, re-applies **all migrations in order**, then runs **seed** | The default. Use when you want a clean, deterministic database (stale schema, after pulling new migrations, before a demo). |
| `pnpm db:migrate` | Applies pending migrations | Apply new migrations without wiping existing data. |
| `pnpm db:seed` | Runs `supabase/seed.sql` | Re-seed the fictional demo data after migrations. |
| `pnpm db:generate` | `drizzle-kit generate` → `packages/db/drizzle` | **Review only.** Produces SQL to read; do **not** apply it directly. |

## Authoring a schema change into the canonical history

1. Update the Drizzle schema in `packages/db/src/schema.ts` (the typed mirror).
2. Run `pnpm db:generate` to produce candidate SQL in `packages/db/drizzle`.
3. **Review** that SQL by hand. Fold the relevant DDL into a **new timestamped
   migration** in `supabase/migrations/` (e.g. `20260301000600_*.sql`). Add RLS
   policies, triggers, grants, and any Supabase-specific objects there too — these
   do not come from Drizzle.
4. Never edit an already-applied migration; always append a new one.
5. Run `pnpm supabase:reset` to verify the full history applies cleanly and the
   seed still loads.

> The generated Drizzle SQL is a **review aid only**. It is never applied from a
> second mechanism — the `supabase/migrations/` history is the only apply path.

## Seed data

`supabase/seed.sql` runs **after** migrations and creates the fictional demo
accounts (Customer A / Customer B / Admin, `@markaz.demo` emails) plus fictional
Dubai properties, listings, offers, and transactions. Everything is clearly
fictional; no real personal or property documents are used.

## Notes

- `pnpm supabase:reset` requires the local Supabase Docker stack
  (`pnpm supabase:start`).
- Migrations and admin/seed ops connect to the database **directly**
  (`DIRECT_DATABASE_URL`), not through the pooler (ADR 0005).
