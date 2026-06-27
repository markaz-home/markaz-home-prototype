# Runbook: Local Development

From a clean clone to both apps running against a local Supabase stack.

## Prerequisites

- **Node 22** — match the version in `.nvmrc`/`package.json` engines.
- **pnpm 9** — via Corepack (`corepack enable && corepack prepare pnpm@9 --activate`)
  or a pinned standalone install. Do **not** use npm/yarn at the root.
- **Docker** (running) — the Supabase local stack runs in Docker.
- The **Supabase CLI is a pinned dev dependency**; run it via `pnpm supabase`.
  Do **not** install it globally.

## Steps

```bash
# 1. Install workspace dependencies
pnpm install

# 2. Create your local env file
cp .env.example .env

# 3. Start the local Supabase stack (Docker)
pnpm supabase:start

# 4. Apply the canonical migrations + seed
pnpm supabase:reset

# 5. Run both apps
pnpm dev
```

`pnpm dev` runs the customer app on **:3000** and the admin app on **:3001**.

## Ports

| Service | URL / Port |
| --- | --- |
| Customer app (`apps/web`) | http://localhost:3000 |
| Admin app (`apps/admin`) | http://localhost:3001 |
| Supabase API (Kong) | http://127.0.0.1:54321 |
| Postgres database | 127.0.0.1:54322 |
| Supabase Studio | http://127.0.0.1:54323 |
| Inbucket (email/OTP inbox) | http://127.0.0.1:54324 |

## Environment variables

Defined in `.env.example` (copied to `.env`). See `infra/environment-contract.md`
for which are **server-only**. Key ones:

- Public: `NEXT_PUBLIC_WEB_URL`, `NEXT_PUBLIC_ADMIN_URL`,
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `NEXT_PUBLIC_DEFAULT_LOCALE`, `NEXT_PUBLIC_SUPPORTED_LOCALES`.
- **Server-only:** `DATABASE_URL` (pooled app path), `DIRECT_DATABASE_URL`
  (direct — migrations/realtime/admin), `SUPABASE_SERVICE_ROLE_KEY`.
- Demo contract (fallback disabled): `DEMO_ENVIRONMENT`, `DEMO_AUTH_FALLBACK`,
  `DEMO_AUTH_ALLOWLIST`.

## Common commands

```bash
pnpm dev            # run apps
pnpm build          # build all
pnpm lint           # eslint
pnpm typecheck      # tsc --noEmit (strict)
pnpm test           # unit/component (Vitest)
pnpm test:e2e       # Playwright (needs the local Supabase stack running)

pnpm db:generate    # drizzle-kit generate (REVIEW only; fold into canonical SQL)
pnpm db:migrate     # apply migrations
pnpm db:seed        # run supabase/seed.sql

pnpm supabase:start   # start Docker stack
pnpm supabase:stop    # stop Docker stack
pnpm supabase:reset   # drop + re-apply migrations + seed
pnpm supabase:status  # show local service status/URLs
```

> Integration tests and e2e tests require the **local Supabase stack running**
> (`pnpm supabase:start`).

## Troubleshooting

- **Docker not running** — start Docker Desktop; `pnpm supabase:start` needs it.
- **Port already in use** — stop the conflicting process or stop a prior stack
  with `pnpm supabase:stop`.
- **Schema looks stale / out of sync** — run `pnpm supabase:reset` to rebuild
  from migrations + seed (see `database-reset.md`).
- **Cannot log in** — see `authentication.md` (OTP via Inbucket at :54324).
