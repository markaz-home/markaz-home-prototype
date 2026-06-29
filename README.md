# MARKAZ Home

A property marketplace for the UAE (initial focus: Dubai). A single customer
account can both **sell** (list a property) and **buy** (browse, make offers, move
through a transaction). Admin operations live in a separate application.

This repository is the **Week 1 application foundation**: the monorepo, shared
packages, real authentication, the database with Row-Level Security, storage, a
Realtime proof, and the documentation set.

## Week 1 scope

- Turborepo + pnpm monorepo with strict TypeScript.
- Two apps: customer/public (`apps/web`) and a separate admin app (`apps/admin`).
- Shared `@markaz/*` packages (config, ui, i18n, domain, db, auth, api, realtime,
  observability).
- **Email + password** auth (Supabase) + onboarding routing. Email 6-digit codes
  are used **only** for account verification and password recovery (ADR 0009).
- Profiles + marketplace schema with a full **RLS policy set** and an
  integration-test gate.
- Storage buckets (private + public) with boundary tests.
- A Supabase **Realtime** end-to-end proof.
- Canonical SQL migrations + fictional seed data.
- Architecture decisions (ADRs) and runbooks.

## Repository structure

```
markaz-home-prototype/
├─ apps/
│  ├─ web/                 # Customer/public app (port 3000)
│  ├─ admin/               # Separate admin app (port 3001)
│  └─ worker/              # Durable jobs — placeholder only (Week 1)
├─ packages/
│  ├─ config/             # eslint / tsconfig / tailwind presets
│  ├─ ui/                 # shadcn/Radix design system + tokens (RTL-safe)
│  ├─ i18n/               # next-intl (en + ar), RTL, AED formatting
│  ├─ domain/             # types, state machines, zod, resolvePostAuthDestination
│  ├─ db/                 # Drizzle schema + client + withUserContext (RLS)
│  ├─ auth/               # Supabase SSR clients + RBAC
│  ├─ api/                # tRPC routers + procedure tiers
│  ├─ realtime/           # Supabase Realtime hook
│  └─ observability/      # pino logging
├─ supabase/
│  ├─ migrations/         # Canonical ordered SQL history
│  ├─ seed.sql            # Fictional demo data (runs after migrations)
│  └─ config.toml         # Local Supabase stack config
├─ docs/
│  ├─ adr/                # Architecture Decision Records
│  ├─ architecture/       # Overview, auth & RLS, realtime
│  └─ runbooks/           # local-development, authentication, database-reset, demo
├─ infra/                 # Boundary contracts/placeholders (AWS NOT provisioned)
├─ tests/
├─ .env.example
├─ package.json
├─ pnpm-workspace.yaml
└─ turbo.json
```

## Required software

- **Node 22**
- **pnpm 9** (via Corepack or a pinned standalone install)
- **Docker** (running) — for the local Supabase stack

The **Supabase CLI is a pinned dev dependency** (run via `pnpm supabase`); do not
install it globally.

## Stack

Turborepo 2, TypeScript 5 (strict), Next.js 15 (App Router), React 19,
Tailwind 3.4, shadcn/Radix, next-intl 3, TanStack Query 5, tRPC 11, Drizzle ORM
0.38 + postgres-js, Supabase (auth/realtime/storage), react-hook-form 7 + zod 3,
Vitest 2, Playwright, pino.

## Local installation

```bash
pnpm install
cp .env.example .env
pnpm supabase:start    # start the local Supabase Docker stack (Docker engine must be running)
# Copy the keys printed by `supabase start` into .env (see "Supabase keys" below)
pnpm supabase:reset    # apply canonical migrations + (minimal) seed
pnpm db:setup          # provision demo Auth users (Admin API) + demo data
pnpm dev               # web on :3000, admin on :3001
```

See `docs/runbooks/local-development.md` for ports and troubleshooting, and the
**Troubleshooting** section at the bottom of this file for the common
Docker-engine / Supabase-key / verification-email gotchas.

### Supabase keys

`pnpm supabase:start` prints the keys your local stack expects. **Newer Supabase
CLIs (≥ 2.10x) use the new key format** — copy them into `.env` like this:

| `supabase start` output | `.env` variable |
| --- | --- |
| `Publishable` (`sb_publishable_…`) **or** legacy `anon` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `Secret` (`sb_secret_…`) **or** legacy `service_role` | `SUPABASE_SERVICE_ROLE_KEY` |
| `DB URL` (`postgresql://postgres:postgres@127.0.0.1:54322/postgres`) | `DATABASE_URL` and `DIRECT_DATABASE_URL` |

The publishable key is browser-safe and works as the client key; the secret key
is server-only and is **never** used for customer-scoped requests.

## Environment variables

All variables are enumerated in **`.env.example`** (copy to `.env`). Public
(`NEXT_PUBLIC_*`) values are browser-safe; `DATABASE_URL`,
`DIRECT_DATABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` are **server-only**. See
`infra/environment-contract.md` for which connection path uses the pooler vs the
direct endpoint.

## Supabase local setup & auth testing

The local stack runs in Docker. Service URLs (after `pnpm supabase:start`):

| Service | URL |
| --- | --- |
| Supabase API | http://127.0.0.1:54321 |
| Postgres | 127.0.0.1:54322 |
| Studio | http://127.0.0.1:54323 |
| **Mail inbox** (verification code + recovery link) — Mailpit, or Inbucket on older CLIs | http://127.0.0.1:54324 |

Authentication is **email + password** (ADR 0009). A 6-digit email code is used
**only** for **new-account email verification**; **password recovery uses the
official Supabase recovery LINK** (Forgot Password → email link → `/auth/confirm`
→ Reset Password). Neither is the sign-in credential. Locally, no real email is
sent — read the **code** (`confirmation.html`, `{{ .Token }}`) or click the
**recovery link** (`recovery.html`) in the local mail inbox
(http://127.0.0.1:54324). Codes, links, and tokens are never built, stored, or
logged by app code. See `docs/runbooks/authentication.md`.

Demo accounts (fictional, local-only): `customer-a@markaz.demo`,
`customer-b@markaz.demo` (both CUSTOMER), `admin@markaz.demo` (ADMIN). Provision
them with `pnpm db:setup`. Credentials and the production guard live in
`docs/runbooks/demo-runbook.md`.

## Database: migrate, seed, reset

```bash
pnpm supabase:reset    # drop + re-apply all migrations + (minimal) seed
pnpm db:setup          # provision demo Auth users (Admin API) + demo data
pnpm db:migrate        # apply pending migrations
pnpm db:seed           # run supabase/seed.sql (minimal; no Auth users)
pnpm db:generate       # drizzle-kit generate (REVIEW only; fold into canonical SQL)
```

`supabase/seed.sql` is intentionally minimal — demo **Auth users** and demo data
come from `pnpm db:setup` (Supabase Admin API), not SQL. The local reset flow is
`pnpm supabase:reset && pnpm db:setup`.

Schema is a **single ordered SQL history** in `supabase/migrations/`; Drizzle is
the typed mirror and generated SQL is reviewed in, never applied separately. See
`docs/runbooks/database-reset.md`.

## Running web + admin

`pnpm dev` runs both apps. The customer app (`apps/web`) is on **:3000**; the
admin app (`apps/admin`) is on **:3001**. The customer app exposes **no admin
routes or navigation**; the admin app requires `account_type === 'ADMIN'`.

## Running tests

```bash
pnpm test       # unit / component (Vitest)
pnpm test:e2e   # end-to-end (Playwright)
```

> **Integration tests and e2e tests require the local Supabase stack running**
> (`pnpm supabase:start`). Unit/component tests do not.

## Architecture decisions

- [ADR 0001 — Monorepo](docs/adr/0001-monorepo.md)
- [ADR 0002 — Unified customer account](docs/adr/0002-unified-customer-account.md)
- [ADR 0003 — Canonical migrations](docs/adr/0003-canonical-migrations.md)
- [ADR 0004 — tRPC + Drizzle RLS context](docs/adr/0004-trpc-drizzle-rls-context.md)
- [ADR 0005 — Realtime direct database connection](docs/adr/0005-realtime-direct-database-connection.md)
- [ADR 0006 — Self-hosted Supabase on RDS (validation pending)](docs/adr/0006-self-hosted-supabase-rds-validation.md)
- [ADR 0007 — Demo-auth fallback (disabled)](docs/adr/0007-demo-auth-fallback.md)
- [ADR 0008 — Separate admin application](docs/adr/0008-separate-admin-application.md)
- [ADR 0009 — Email + password authentication](docs/adr/0009-email-password-authentication.md)
- [ADR 0010 — Listing state-machine retry & invalidation](docs/adr/0010-listing-state-machine-retry.md)
- [ADR 0011 — Draft-photo privacy](docs/adr/0011-draft-photo-privacy.md)

See also `docs/architecture/` (overview, auth & RLS, realtime, property-listing,
listing-state-machine, listing-storage) and `docs/runbooks/` (local-development,
authentication, database-reset, demo). Milestone reports: `WEEK-1.md`,
`WEEK-1.5.md`, `WEEK-2.md`.

## Platform workstream boundary

The **platform-engineering team** owns AWS/Terraform/RDS/ECS/ECR/SES/ElastiCache/
SonarQube and the self-hosted Supabase deployment in **me-central-1 (UAE)**.
Week 1 did **not** provision AWS. `infra/` contains **boundary contracts and
placeholders only** — no real Terraform. Application development runs on the
official Supabase local Docker stack; a managed-Supabase bridge is available for
demo-only environments.

## Deferred functionality

- **Publishing** a listing to `LIVE` and the live **marketplace / browse**
  (the listing-creation wizard `DRAFT → READY_TO_PUBLISH` is complete — see
  `WEEK-2.md` and `docs/architecture/property-listing.md`).
- **Offers** and counter-offers UX.
- **Transactions** UX.
- **Durable background jobs** (`apps/worker`).
- The full **admin application** surface.

## Known limitations

- **Session-expired detection is best-effort** — surfaced via a `?expired=1` hint
  on the sign-in route, not a guaranteed server signal (ADR 0009).
- **Demo Auth users have random UUIDs** — they are created via the Admin API, so
  integration tests resolve them by email, not by a fixed ID.
- **Demo-auth one-click fallback is DISABLED** — only the env contract and docs
  exist; the blocker is a supported, secure server-side session-minting mechanism
  (ADR 0007).
- **Arabic legal copy needs business review** — Arabic strings are present but the
  legal/business wording is **not yet reviewed**.
- **Self-hosted-Supabase-on-RDS is NOT validated** — the §6A.1 gate
  (`infra/supabase/rds-compatibility-checklist.md`, ADR 0006) must pass before any
  production claim.

## Next milestone: the property-listing journey

A state-machine-driven listing wizard:

`DRAFT → Property Details → Ownership Upload → Ownership Verification (sim) →
Listing & Offer Settings → Investment Case → Form A (sim) → Photos →
Trakheesi (sim) → Review → READY_TO_PUBLISH`

Steps marked **(sim)** are simulated in the demo (ownership verification, Form A,
and Trakheesi permit).

## Troubleshooting

**`pnpm install` says "No package.json found".** You're in the parent folder. The
monorepo root is `markaz-home-prototype/` — `cd` into it first.

**`pnpm supabase:start` hangs with no output.** The Docker **engine** isn't
running (Docker Desktop shows "Engine stopped"). `docker ps` will hang too. Start
Docker Desktop, wait for the status to go green ("Engine running"), confirm with
`docker ps` (must return instantly), then retry. If Docker won't start, a reboot
clears stuck Docker processes.

**`toomanyrequests: Rate exceeded` during first start.** Docker registry
throttling while pulling Supabase images. The CLI retries automatically; just let
it finish. Subsequent starts are fast (images are cached).

**A stray `markaz-*` container is crash-looping** (`docker ps` shows
`Restarting`). It's an unrelated leftover — remove it: `docker rm -f <name>`
(removes only the container, not data volumes).

**The *verification* email shows a link instead of a 6-digit code.** Only the
`confirmation.html` template wasn't picked up. Templates live in
`supabase/templates/` and are wired in `supabase/config.toml` under
`[auth.email.template.*]`: `confirmation.html` carries the **code**
(`{{ .Token }}`), while `recovery.html` intentionally carries the **link**
(`{{ .RedirectTo }}/auth/confirm?token_hash=…&type=recovery`). A **recovery**
email containing a link is **correct** — recovery uses the official Supabase link,
not a code (ADR 0009). Restart the stack
(`pnpm supabase:stop && pnpm supabase:start`) and request a **fresh** email.

**Auth fails after the keys look set.** Make sure you copied the keys your CLI
actually printed into `.env` (newer CLIs print `sb_publishable_…` / `sb_secret_…`
— see "Supabase keys" above), and that `.env` is at the repo root (both apps load
it from there).

**`config section [inbucket] is deprecated` warning.** Harmless. Newer CLIs use
Mailpit at the same port (54324); the local mail inbox still works.
