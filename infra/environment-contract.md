# Environment Contract

The required-service inventory, port assumptions, networking assumptions, and
database connection requirements for running MARKAZ Home. This is a contract, not
a provisioning script — AWS is not provisioned here (see `README.md`).

## Required services

| Service           | Local (Week 1)                   | Production (platform-owned)            |
| ----------------- | -------------------------------- | -------------------------------------- |
| PostgreSQL        | Supabase CLI Docker (`:54322`)   | RDS for PostgreSQL, Multi-AZ           |
| Auth (OTP)        | Supabase Auth (GoTrue) in Docker | Self-hosted Supabase Auth              |
| Email delivery    | Inbucket (`:54324`)              | SES                                    |
| Realtime          | Supabase Realtime in Docker      | Self-hosted Realtime, **direct** to DB |
| Storage           | Supabase Storage in Docker       | Self-hosted Storage                    |
| Connection pooler | n/a locally                      | RDS Proxy (app paths only)             |

## Port assumptions (local)

| Service                   | Port  |
| ------------------------- | ----- |
| Customer app (`apps/web`) | 3000  |
| Admin app (`apps/admin`)  | 3001  |
| Supabase API (Kong)       | 54321 |
| Postgres                  | 54322 |
| Supabase Studio           | 54323 |
| Inbucket                  | 54324 |

## Networking assumptions (production)

- Region **me-central-1 (UAE)**; all data resides in-region (data residency).
- The customer and admin apps are deployed to **separate hosts/origins**
  (`NEXT_PUBLIC_WEB_URL`, `NEXT_PUBLIC_ADMIN_URL`) — ADR 0008.
- A **direct** database endpoint is exposed for Realtime and migrations, separate
  from the pooled app endpoint.

## Database connection requirements

Two connection paths, distinguished by env var:

| Path              | Env var               | Pooled vs direct                                 | Used by                                                               |
| ----------------- | --------------------- | ------------------------------------------------ | --------------------------------------------------------------------- |
| App / API queries | `DATABASE_URL`        | **Pooled** (RDS Proxy in prod, where compatible) | tRPC resolvers, `withUserContext` / `withAnonContext`                 |
| Direct ops        | `DIRECT_DATABASE_URL` | **Direct** (never the pooler)                    | Migrations, seed, admin maintenance, **Realtime/logical replication** |

- **Realtime must use the direct path** — RDS Proxy does not support logical
  replication (ADR 0005).
- The future Graphile Worker (`apps/worker`) uses the direct path or a
  **separately-validated** pool appropriate to its workload.

## Server-only environment variables

These must **never** be exposed to the browser (no `NEXT_PUBLIC_` prefix):

- `DATABASE_URL`
- `DIRECT_DATABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` — trusted server ops only; **never** used to serve a
  customer-scoped request (ADR 0004).

Browser-safe (`NEXT_PUBLIC_`): `NEXT_PUBLIC_WEB_URL`, `NEXT_PUBLIC_ADMIN_URL`,
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`NEXT_PUBLIC_DEFAULT_LOCALE`, `NEXT_PUBLIC_SUPPORTED_LOCALES`.

Demo-auth contract (fallback **disabled** — ADR 0007): `DEMO_ENVIRONMENT`,
`DEMO_AUTH_FALLBACK`, `DEMO_AUTH_ALLOWLIST`.

All variables are enumerated in `.env.example` at the repo root.
