# Runbook: Database Migrations, Seed, and Reset

The database is rebuilt from a **single ordered SQL history** in
`supabase/migrations/`, followed by `supabase/seed.sql` (ADR 0003).

## The full local reset flow

```bash
pnpm supabase:reset && pnpm db:setup
```

`supabase:reset` rebuilds the schema (and runs the minimal seed);
`pnpm db:setup` then provisions the demo **Auth users + demo data** via the
Supabase **Admin API**. You need **both** for a usable local environment — reset
alone leaves you with no demo accounts.

## Commands

| Command | What it does | When to use |
| --- | --- | --- |
| `pnpm supabase:reset` | Drops the DB, re-applies **all migrations in order**, then runs the **(minimal) seed** | The default first step. Clean, deterministic schema (stale schema, after pulling migrations, before a demo). |
| `pnpm db:setup` | Provisions demo Auth users (Admin API) + demo domain data, **idempotently** | The required second step. Creates Customer A / B / Admin and seeds demo data. |
| `pnpm db:migrate` | Applies pending migrations | Apply new migrations without wiping existing data. |
| `pnpm db:seed` | Runs `supabase/seed.sql` | Rarely needed directly; the minimal seed runs as part of `supabase:reset`. |
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

## Seed data and demo provisioning

`supabase/seed.sql` is now **intentionally minimal**: it does **not** create Auth
users or demo domain data. Writing Supabase Auth tables via SQL is unsupported,
so the demo accounts (Customer A / Customer B / Admin, `@markaz.demo`) and the
fictional Dubai properties/listings/offers/transactions are provisioned by
`pnpm db:setup` (`packages/db/src/scripts/setup-demo.ts`) using the Supabase
**Admin API** (`auth.admin.createUser`, then admin promotion + `VERIFIED_DEMO` +
demo data). The script is **idempotent** and **refuses to run** when
`DEMO_ENVIRONMENT=production` or `NODE_ENV=production`.

Because demo Auth users are created via the Admin API, their IDs are **random
UUIDs** — integration tests resolve them by **email**, not by a fixed ID.

Everything seeded is clearly fictional; no real personal or property documents are
used. Credentials and details: see `demo-runbook.md`.

## Notes

- `pnpm supabase:reset` and `pnpm db:setup` require the local Supabase Docker
  stack (`pnpm supabase:start`).
- Migrations and admin/setup ops connect to the database **directly**
  (`DIRECT_DATABASE_URL`), not through the pooler (ADR 0005).
