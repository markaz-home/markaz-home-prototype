# Self-Hosted Supabase on RDS — Compatibility Checklist (§6A.1)

```
┌────────────────────────────────────────────────────────────────────┐
│  STATUS: NOT YET VALIDATED                                          │
│  Self-hosted Supabase on AWS RDS has NOT been validated.            │
│  No production claim may be made until every item below passes.     │
│  Owner: platform-engineering team.  See ADR 0006.                   │
└────────────────────────────────────────────────────────────────────┘
```

This is the actionable §6A.1 gate. Application development runs on the official
Supabase local Docker stack in the meantime; a managed-Supabase bridge is
available for demo-only environments.

## Checklist

- [ ] **PostgreSQL version** — RDS engine version matches what the Supabase
      components require.
- [ ] **Supabase roles & privileges** — `authenticator`, `anon`, `authenticated`,
      `service_role`, `supabase_admin` (and others) can be created with the
      required grants under RDS's non-superuser model.
- [ ] **Extensions** — required extensions are available and installable on RDS
      (`pgcrypto`, `pgjwt`, `uuid-ossp`, `pg_stat_statements`, `pg_graphql`, and
      any others Supabase components depend on).
- [ ] **Auth schema** — the `auth.*` schema installs and operates (GoTrue),
      including the `handle_new_user()` trigger on `auth.users`.
- [ ] **Storage schema** — the `storage.*` schema installs and operates; bucket
      and `storage.objects` RLS behave as in local.
- [ ] **Realtime / logical replication** — works on the **direct** RDS endpoint:
      replication slots, `wal_level=logical`, the `supabase_realtime` publication.
      **RDS Proxy must NOT front Realtime** (ADR 0005).
- [ ] **Migration ownership** — the migrating role can create/alter/own all
      objects in the canonical history (ADR 0003) on RDS.
- [ ] **Backup / restore** — RDS snapshots + PITR restore a fully working Supabase
      database (roles, extensions, replication, publications intact).
- [ ] **RDS limitations reviewed** — no superuser, restricted `pg_hba`,
      parameter-group-only configuration, event-trigger / extension restrictions,
      and any other managed-RDS constraints that Supabase components assume.

## Fallback (if RDS cannot pass)

Run a **self-managed PostgreSQL container** (Supabase's own Postgres image) on
platform-managed compute, trading managed-database operations for full control of
roles, extensions, and logical replication. This fallback is also unvalidated
until exercised.
