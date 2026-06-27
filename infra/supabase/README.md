# Supabase Infrastructure

## Local development

Local development uses the **official Supabase CLI Docker stack**, configured by
`supabase/config.toml` at the repo root. Start it with `pnpm supabase:start` and
rebuild with `pnpm supabase:reset` (migrations + seed). The Supabase CLI is a
**pinned dev dependency** (run via `pnpm supabase`), not a global install — image
versions are pinned by the CLI/config so every contributor runs the same stack.

## Production (owned by platform)

The **production self-hosting configuration** for Supabase (in **me-central-1,
UAE**) is **owned by the platform-engineering team**. It is **not** configured in
this repository.

> **Self-hosted Supabase on RDS is NOT validated.** Before any production claim,
> the platform team must complete the §6A.1 checklist
> (`rds-compatibility-checklist.md`, ADR 0006). Until then, application work runs
> on the local Docker stack, and a managed-Supabase bridge is available for
> demo-only environments.

## Pinned image versions

Local Supabase component images (Postgres, Auth/GoTrue, Realtime, Storage, Kong,
Studio, Inbucket, etc.) are **pinned** via the Supabase CLI / `config.toml` so
local environments are reproducible. Production image pinning is a platform
responsibility and must align with the versions validated in the RDS
compatibility checklist.
