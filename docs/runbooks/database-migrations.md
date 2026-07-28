# Runbook: Database migrations

`supabase/migrations/` is the only apply history. Migrations are forward-only and ordered by their
timestamp. Drizzle schema files are the typed mirror; `pnpm db:generate` produces review material,
not a second migration stream.

## Pre-deploy

1. Resolve the exact release tag/commit and review every migration added since the deployed commit.
2. Review locks, backfills, extension requirements, function ownership, explicit `search_path`,
   grants/revokes, RLS enablement, and data-loss risk.
3. Take and verify a backup according to `backup-restore.md`.
4. Run `pnpm supabase:reset` on a fresh local stack.
5. Run the full integration suite; skipped RLS/Storage tests are a failed gate.
6. Compare hosted migration history and schema to the release. Any unexplained drift is a no-go.

## Apply

Use the direct database path, never the pooled application path:

```bash
pnpm db:migrate
```

Apply before code that depends on the new schema. Record operator, environment, start/end time,
release SHA, migration names, and outcome.

## Security invariants

- `auth.uid()` plus RLS is the customer security boundary.
- Customer writes to offer/transaction/Admin workflows pass through reviewed `SECURITY DEFINER`
  functions that re-derive the actor and pin `search_path`.
- Function execute grants are explicit; audit rows are append-only and update/delete/truncate grants
  are revoked.
- Admin capability checks exist in API and database; UI visibility is not authorization.
- The seed is minimal. It creates no Auth users or shared demo data.

## Fresh replay evidence

On 2026-07-28, `pnpm supabase:reset` successfully replayed `0100` through
`20260301000821_storage_production_constraints.sql`, followed by the minimal seed. Required local
extensions were initialized by the canonical history. Full RLS totals are recorded in `WEEK-8.md`.

## Rollback

Do not edit an applied migration and do not improvise a destructive down migration. Roll application
code back only when it remains compatible. For an irreversible schema/data incident, stop writes and
restore a verified pre-deploy backup into an isolated target before traffic cutover. See
`ROLLBACK-RUNBOOK.md`.
