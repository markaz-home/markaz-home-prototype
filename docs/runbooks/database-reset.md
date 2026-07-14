# Runbook: Database Migrations, Seed, and Reset

The database is rebuilt from a **single ordered SQL history** in
`supabase/migrations/`, followed by `supabase/seed.sql` (ADR 0003).

## The full local reset flow

```bash
pnpm supabase:reset    # rebuild schema; then SIGN UP in the app
```

`supabase:reset` rebuilds the schema (and runs the minimal seed). **No accounts are
seeded** — open the web app and sign up. To create an admin (optional, env-driven):
`BOOTSTRAP_ADMIN_EMAIL=… BOOTSTRAP_ADMIN_PASSWORD=… pnpm db:setup`.

## Commands

| Command | What it does | When to use |
| --- | --- | --- |
| `pnpm supabase:reset` | Drops the DB, re-applies **all migrations in order**, then runs the **(minimal) seed** | The default first step. Clean, deterministic schema (stale schema, after pulling migrations, before a demo). |
| `pnpm db:setup` | **Optional** env-driven admin bootstrap (Admin API), **idempotent**; no-op without `BOOTSTRAP_ADMIN_EMAIL` | Only when you want to create/refresh the single admin account. |
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

`supabase/seed.sql` is **intentionally minimal**: it does **not** create Auth users or
domain data. **Customers sign up through the app** (the `handle_new_user` trigger creates
each `profiles` row), so nothing needs seeding for a usable environment. The only optional
provisioning is the **env-driven admin bootstrap** `pnpm db:setup`
(`packages/db/src/scripts/setup-demo.ts`), which — when `BOOTSTRAP_ADMIN_EMAIL` /
`BOOTSTRAP_ADMIN_PASSWORD` are set — creates one ADMIN via the Supabase **Admin API**
(`auth.admin.createUser`, then admin promotion). It is **idempotent** and a **no-op** when
no admin env is set. Writing Supabase Auth tables via SQL is unsupported, hence the Admin
API.

See `demo-runbook.md` for the sign-up + admin-bootstrap steps.

## Notes

- `pnpm supabase:reset` and `pnpm db:setup` require the local Supabase Docker
  stack (`pnpm supabase:start`).
- Migrations and admin/setup ops connect to the database **directly**
  (`DIRECT_DATABASE_URL`), not through the pooler (ADR 0005).
