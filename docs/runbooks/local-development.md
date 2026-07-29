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

# 2. Start the local Supabase stack (Docker)
pnpm supabase:start

# 3. Create `.env.local` from `.env.example`, then replace the Supabase/DB
#    placeholders with CURRENT values from `supabase status -o env`.
#    For SUPABASE_SERVICE_ROLE_KEY use SERVICE_ROLE_KEY (legacy JWT), not
#    SECRET_KEY; the local Admin API/bootstrap requires the role JWT.
cp .env.example .env.local

# 4. Validate configuration and apply migrations + minimal seed
pnpm config:check
pnpm supabase:reset

# 5. Run both apps, then SIGN UP in the web app to create accounts
pnpm dev
```

> **No accounts are seeded** — open the web app and **sign up** (read the 6-digit code
> from Mailpit at :54324 to verify). To create an admin (optional), run
> `BOOTSTRAP_ADMIN_EMAIL=you@example.com BOOTSTRAP_ADMIN_PASSWORD='…' pnpm db:setup`.
> See `demo-runbook.md`.

`pnpm dev` runs the customer app on **:3000** and the admin app on **:3001**.

## Ports

| Service                                                                             | URL / Port             |
| ----------------------------------------------------------------------------------- | ---------------------- |
| Customer app (`apps/web`)                                                           | http://localhost:3000  |
| Admin app (`apps/admin`)                                                            | http://localhost:3001  |
| Supabase API (Kong)                                                                 | http://127.0.0.1:54321 |
| Postgres database                                                                   | 127.0.0.1:54322        |
| Supabase Studio                                                                     | http://127.0.0.1:54323 |
| Mail inbox (verification code + recovery link) — Mailpit, or Inbucket on older CLIs | http://127.0.0.1:54324 |

## Environment variables

Defined in `.env.example` (copied to ignored `.env.local`). See
`ENVIRONMENT-VARIABLES.md` and `infra/environment-contract.md`
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
pnpm config:check   # fail safely on missing/unsafe configuration
pnpm security:secrets # scan repository candidates without printing values

pnpm db:generate    # drizzle-kit generate (REVIEW only; fold into canonical SQL)
pnpm db:migrate     # apply migrations
pnpm db:seed        # run supabase/seed.sql (minimal; no Auth users)
pnpm db:setup       # optional admin bootstrap (env-driven); no-op without env

pnpm supabase:start   # start Docker stack
pnpm supabase:stop    # stop Docker stack
pnpm supabase:reset   # drop + re-apply migrations + seed
pnpm supabase:status  # show local service status/URLs
```

## Troubleshooting

- **Docker not running** — start Docker Desktop; `pnpm supabase:start` needs it.
- **Port already in use** — stop the conflicting process or stop a prior stack
  with `pnpm supabase:stop`.
- **Schema looks stale / out of sync** — run `pnpm supabase:reset` to rebuild
  from migrations + seed (see `database-reset.md`).
- **Cannot log in** — see `authentication.md` (email + password; the new-account
  verification **code** and the password-recovery **link** arrive in the mail
  inbox at :54324). **Sign up** in the app first — no accounts are pre-seeded.
- **Storage/integration tests skip while the stack is up** — `.env.local` likely has a
  stale `sb_secret_` value. Refresh all local values from `supabase status -o env` and map
  its legacy `SERVICE_ROLE_KEY` JWT to `SUPABASE_SERVICE_ROLE_KEY`.
- **Hosted `.env` exists** — keep local-first `.env.local` current. Destructive tests reject
  non-loopback targets, but application dev can still feel slow or affect the wrong environment
  if local overrides are stale.
