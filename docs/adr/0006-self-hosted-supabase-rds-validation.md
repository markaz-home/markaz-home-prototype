# ADR 0006: Self-Hosted Supabase on RDS — Validation Pending

- **Status:** PROPOSED — pending platform validation. **NOT VALIDATED.**
- **Date:** 2026-03

## Context

The target production environment is **self-hosted Supabase** backed by **AWS RDS
for PostgreSQL** in **me-central-1 (UAE)** for data residency. Self-hosting
Supabase against a managed RDS instance (as opposed to the Postgres container the
Supabase CLI runs locally) raises compatibility questions that **must be proven
by the platform-engineering team** before we can claim production readiness.

Application development in Week 1 runs on the **official Supabase local Docker
stack**. A managed-Supabase bridge is available for demo-only environments. This
ADR does **not** assert that self-hosted-Supabase-on-RDS works — that is the
§6A.1 gate the platform team must complete.

## Decision

Document the validation checklist and a fallback, and treat the production
self-hosting topology as **unvalidated** until the platform team signs off.

### Validation checklist (must all pass before production claims)

- [ ] **PostgreSQL version** matches what Supabase components require.
- [ ] **Supabase roles & privileges** (`authenticator`, `anon`, `authenticated`,
      `service_role`, `supabase_admin`, etc.) can be created with the required
      grants on RDS (RDS restricts superuser).
- [ ] **Required extensions** are available and installable on RDS (`pgcrypto`,
      `pgjwt`, `uuid-ossp`, `pg_stat_statements`, `pg_graphql`, etc.).
- [ ] **Auth schema** (`auth.*`) installs and operates correctly.
- [ ] **Storage schema** (`storage.*`) installs and operates correctly.
- [ ] **Realtime / logical replication** works on the **direct** RDS endpoint
      (replication slots, `supabase_realtime` publication) — see ADR 0005. RDS
      Proxy must not front Realtime.
- [ ] **Migration ownership** — the migrating role can own/alter the objects in
      the canonical history (ADR 0003) on RDS.
- [ ] **Backup / restore** — RDS snapshots + PITR restore a working Supabase
      database (roles, extensions, replication intact).
- [ ] **RDS limitations** reviewed — no superuser, restricted `pg_hba`,
      parameter-group-only settings, event-trigger / extension restrictions that
      Supabase components assume.

### Fallback

If RDS cannot satisfy the checklist, fall back to a **self-managed PostgreSQL
container** (Supabase's own Postgres image) running on platform-managed compute,
trading managed-database operations for full control over roles, extensions, and
replication.

## Consequences

- Until the checklist is fully green, **no production deployment** against
  self-hosted-Supabase-on-RDS may be claimed or shipped.
- Week 1 application work is decoupled from this gate by running on the local
  Docker stack and (for demos) the managed-Supabase bridge.
- The checklist lives as an actionable artifact at
  `infra/supabase/rds-compatibility-checklist.md`.
