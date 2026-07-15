# MARKAZ Home

A property marketplace for the UAE (initial focus: Dubai). A single **customer**
account can both **sell** (list a property) and **buy** (browse, make offers, move
through a transaction). Admin operations live in a **separate** application. Real
engineering throughout; only the regulated integrations (UAE PASS, DLD, Trakheesi,
payment) are **simulated** — behind named interfaces, with persisted outcomes.

This repository implements **Weeks 1–6**: the application foundation, the listing
wizard, publication + marketplace, offers & negotiation, the transaction tracker,
and the admin portal.

## What's built

| Milestone  | Summary                                                                                                                                                                           | Report                     |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| **Week 1** | Monorepo, strict TS, email+password auth + onboarding, RLS-first schema, storage buckets, realtime proof                                                                          | `WEEK-1.md`, `WEEK-1.5.md` |
| **Week 2** | Listing wizard `DRAFT → READY_TO_PUBLISH` (details, ownership + simulated verification, investment case, photos, simulated Form A / Trakheesi)                                    | `WEEK-2.md`                |
| **Week 3** | Publication (`READY_TO_PUBLISH → LIVE`) via an idempotent compensated photo pipeline; anonymous + authed marketplace; saved properties                                            | `WEEK-3.md`                |
| **Week 4** | Non-binding buyer offers / seller offer management — one thread per (buyer, listing), immutable proposals, single-accepted-offer enforcement                                      | `WEEK-4.md`                |
| **Week 5** | Shared **simulated** transaction tracker on an accepted offer (17 milestones / 6 stages), private participant-scoped documents                                                    | `WEEK-5.md`                |
| **Week 6** | Separate **admin portal** — capability-gated, reason-coded, audited operational controls (restriction, publication review, listing/transaction recovery, audited document access) | `WEEK-6.md`                |

Everything regulated is **simulated** — no real payment, escrow, contract, DLD,
Trakheesi, or UAE PASS integration is performed.

## Required software

- **Node 22**
- **pnpm 9** (via Corepack or a pinned standalone install)
- **Docker** (running) — for the local Supabase stack

The **Supabase CLI is a pinned dev dependency** (run via `pnpm supabase`); do not
install it globally.

## Stack

Turborepo 2, TypeScript 5 (strict), Next.js 15 (App Router), React 19, Tailwind 3.4,
shadcn/Radix, next-intl 3, TanStack Query 5, tRPC 11, Drizzle ORM + postgres-js,
Supabase (auth/realtime/storage), react-hook-form 7 + zod 3, Vitest 2, Playwright, pino.

## Local installation

```bash
pnpm install
pnpm supabase:start    # start the local Supabase Docker stack (Docker engine must be running)
```

Then point local dev at the **local** stack. Env precedence is `.env.local`
(local, gitignored) → `.env` (the hosted/deploy contract). Create `.env.local`
from the keys `supabase start` printed:

```bash
# .env.local  — local overrides; both apps + db scripts prefer this over .env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<sb_publishable_… from `supabase status`>
SUPABASE_SERVICE_ROLE_KEY=<sb_secret_… from `supabase status`>
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
DIRECT_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

```bash
pnpm supabase:reset            # apply canonical migrations (see the reset note below)
pnpm dev                       # web on :3000, admin on :3001
```

> **Why `.env.local`?** If you point local dev at a _hosted_ project (e.g. Supabase
> in Mumbai), every SSR query round-trips out of region and the app feels laggy.
> `.env.local` keeps local dev on the local Docker DB (fast). `.env` stays the
> hosted/deploy contract (Vercel reads those from its dashboard).

### `supabase:reset` note (local)

In some environments `supabase db reset` hangs at **"Recreating database…"** — a
`pg_cron`/`pg_net` reconnect quirk that blocks `DROP DATABASE`. If it hangs, use a
fresh start instead (this initializes a new DB and applies the whole migration chain
without a drop step):

```bash
pnpm supabase stop --no-backup && pnpm supabase start
```

### Admin account

There is **no demo-customer seed** — customers sign up through the app (the
`handle_new_user` trigger creates each `profiles` row). To create the single ADMIN,
run the env-driven bootstrap:

```bash
BOOTSTRAP_ADMIN_EMAIL=you@example.com BOOTSTRAP_ADMIN_PASSWORD='<strong>' pnpm db:setup
```

`db:setup` is a no-op without those env vars. It uses the Supabase Admin API (writing
Auth tables via SQL is unsupported) and is idempotent. See ADR-0003 / ADR-0009.

## Repository structure

```
markaz-home-prototype/
├─ apps/{web,admin,worker}       # web=customer (:3000), admin=separate (:3001), worker=placeholder
├─ packages/                     # config, ui, i18n, domain, db, auth, api, realtime, observability
├─ supabase/{migrations,seed.sql,config.toml,templates}
├─ docs/{adr,architecture,runbooks,design}
├─ infra/                        # boundary contracts/placeholders (AWS NOT provisioned)
├─ tests/integration             # RLS/storage/publication/offer/transaction/admin (need the stack)
└─ .github/workflows             # CI (lint/typecheck/unit + a mandatory full-stack job)
```

## Local services (after `pnpm supabase:start`)

| Service                                                      | URL                    |
| ------------------------------------------------------------ | ---------------------- |
| Supabase API                                                 | http://127.0.0.1:54321 |
| Postgres                                                     | 127.0.0.1:54322        |
| Studio                                                       | http://127.0.0.1:54323 |
| **Mail inbox** (verification code + recovery link) — Mailpit | http://127.0.0.1:54324 |

Authentication is **email + password** (ADR-0009). A 6-digit email code verifies a
**new account**; **password recovery uses the official Supabase LINK**. Locally no
real email is sent — read the code / click the link in the mail inbox. Codes, links,
and tokens are never built, stored, or logged by app code.

## Database commands

```bash
pnpm supabase:reset    # drop + re-apply all migrations (+ minimal seed)
pnpm db:migrate        # apply pending migrations (Supabase CLI — local)
pnpm db:setup          # env-driven ADMIN bootstrap (Admin API); no-op without BOOTSTRAP_ADMIN_*
pnpm db:generate       # drizzle-kit generate (REVIEW only; fold into canonical SQL)
```

Schema is a **single ordered SQL history** in `supabase/migrations/` (0100 → 0815);
Drizzle is the typed mirror and generated SQL is reviewed in, never applied separately.
`supabase/seed.sql` is intentionally minimal — **no** demo Auth users. `db:setup` and
the seed/migrate scripts prefer `.env.local`, so local runs never touch a hosted DB
by accident. See `docs/runbooks/database-reset.md`.

## Running tests

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build   # what CI runs
pnpm test:e2e                                            # Playwright (needs the stack + apps)
```

> **Integration + e2e tests require the local Supabase stack** and the service-role
> key. They **skip** when the stack/keys are absent (so `pnpm test` stays green on a
> machine without Docker) — a **skip is not a pass**. CI runs a **mandatory
> full-stack job** where skipped integration/e2e counts as a failure (see
> `.github/workflows`). Run the two app e2e suites **serially** on a memory-limited
> Docker (the concurrent turbo run can exhaust it).

## Architecture decisions

ADRs 0001–0029 in `docs/adr/`. Highlights by milestone:

- **Foundation** 0001–0009 (monorepo, unified customer account, canonical migrations,
  tRPC+Drizzle RLS context, realtime direct connection, separate admin app, email+password).
- **Listing/marketplace** 0010–0013 (state-machine retry, draft-photo privacy, public-photo
  pipeline, anonymous marketplace access).
- **Offers** 0014–0018 · **Transactions** 0019–0023 · **Admin** 0024–0029.

See also `docs/architecture/` (incl. `admin-portal.md`, `offers.md`, `transactions.md`,
`marketplace.md`, `auth-and-rls.md`) and `docs/runbooks/`.

## Deferred (next milestone+)

- **Durable background jobs** (`apps/worker` is a placeholder).
- **Real** DLD / Trakheesi / Madmoun / payment / UAE PASS integrations.
- Any **AWS provisioning** (`infra/` holds boundary contracts only).
- Free-form messaging/chat, contact exchange, email/SMS/push delivery, map search.

## Known limitations

- **Arabic copy is machine-draft** — present but **not** business/legal-reviewed.
- **Edge-runtime build warning** — `A Node.js API (process.version) … not supported in
the Edge Runtime` comes from a transitive dependency of `@supabase/ssr` used by the
  auth middleware (our own `env`/`rbac` are edge-pure). It is **non-fatal** (Next shims
  `process` in Edge; the middleware works) and cannot be removed without patching the
  dependency.
- **Self-hosted-Supabase-on-RDS is NOT validated** (ADR-0006).
- **Session-expired detection is best-effort** (ADR-0009).

## Platform workstream boundary

The platform-engineering team owns AWS/Terraform/RDS/ECS/ECR/SES and the self-hosted
Supabase deployment. This repo did **not** provision AWS; `infra/` contains boundary
contracts and placeholders only. Application development runs on the official Supabase
local Docker stack. For a hosted demo, the closest free Supabase region to the UAE is
**Mumbai (`ap-south-1`)**; co-locate the app (e.g. Vercel region `bom1`) with the DB.

## Troubleshooting

**`pnpm supabase:start` hangs with no output.** The Docker **engine** isn't running.
`docker ps` will hang too. Start Docker Desktop, wait for green, confirm `docker ps`
returns instantly, then retry.

**`supabase db reset` hangs at "Recreating database…".** See the reset note above —
use `pnpm supabase stop --no-backup && pnpm supabase start`.

**The app feels laggy locally.** Local dev is probably hitting a _hosted_ DB via `.env`.
Add `.env.local` pointing at the local stack (see Local installation).

**The _verification_ email shows a link instead of a code.** A **recovery** email
correctly carries a link (ADR-0009); only **confirmation** carries the 6-digit code.
Restart the stack and request a fresh email.

**`config section [inbucket] is deprecated` warning.** Harmless — newer CLIs use
Mailpit at the same port (54324).
