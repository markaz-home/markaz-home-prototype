# CLAUDE.md — MARKAZ Home

Guidance for Claude Code working in this repo. Read before making changes.

## What this is
UAE (Dubai-first) property marketplace prototype. Real engineering; only the
regulated integrations (UAE PASS, DLD, Trakheesi, payment) are **simulated** —
behind named interfaces, with persisted outcomes. This repo is the **Week 1
application foundation**. The full listing wizard, marketplace, offers, and
transactions are **later milestones — do not build them unless asked.**

Monorepo root is `markaz-home-prototype/`. Run all commands from there.

## Hard product rules (do not violate)
- **Two account types only:** `CUSTOMER` and `ADMIN`. Buyer/Seller are *journeys*,
  not roles. Every CUSTOMER can both buy and sell. **No** buyer/seller selection
  screen, **no** per-journey route guards.
- **Admin is a separate app** (`apps/admin`, port 3001). The customer app
  (`apps/web`, port 3000) must expose **no** admin route, link, or nav.
- **Customers can never self-promote to ADMIN** (DB trigger + RLS enforce it).
- **A customer can never offer on a listing they own** (DB trigger + RLS + API).
- **Never** use the Supabase service-role/secret key for customer-scoped requests.
- **Never** build, store, or log OTP codes. Auth is real Supabase email OTP.

## Architecture you must preserve
- **RLS is the security boundary.** Client/route guards are UX only.
- **Authenticated-user context → queries (the key pattern):**
  `packages/db/src/rls-context.ts` `withUserContext()` opens a transaction, sets
  `request.jwt.claims` + `SET LOCAL role authenticated`, so Postgres `auth.uid()`
  resolves and RLS applies. The tRPC `protectedProcedure`/`customerProcedure`/
  `adminProcedure` middleware wrap every resolver in this and pass `ctx.tx`. Use
  `ctx.tx` for all customer-scoped queries. See ADR-0004.
- **One canonical migration history** in `supabase/migrations/` (ordered SQL).
  Drizzle (`packages/db/src/schema.ts`) is the **typed mirror**. If you change the
  schema: write/adjust the SQL migration **and** the Drizzle schema to match;
  `drizzle-kit generate` output (in `packages/db/drizzle/`) is for **review only**,
  fold it into the canonical SQL — never apply a second migration mechanism.
  Seed (`supabase/seed.sql`) runs **after** migrations. See ADR-0003.
- **Realtime connects directly to the DB**, never behind a pooler (ADR-0005).
- **i18n:** all user-facing copy goes through `next-intl` (`packages/i18n/messages/
  {en,ar}.json`). Support RTL via logical CSS properties + the `dir` attribute.
  Don't hardcode strings or left/right. Arabic legal/transactional copy is
  unreviewed — flag it, don't claim it's approved.
- **Design tokens** live in `packages/ui/src/styles/globals.css` and implement the
  approved **MARKAZ "Architectural Blue" foundation** (`docs/design/
  markaz-design-foundation.md`): brand blue scale (`brand-900…100`), Clear Blue
  primary, Cool Off-White canvas, Manrope (interface) + Source Serif 4 (display,
  use `font-display` for hero/public headings), 10px radius, minimal shadows. The
  admin portal uses the dark-blue sidebar. Don't scatter one-off colors/spacing;
  use the tokens and `@markaz/ui` components. Blue is for hierarchy, not weight
  (~65–75% white/off-white).

## Layout
```
apps/{web,admin,worker}        web=customer/public, admin=separate, worker=placeholder
packages/{config,ui,i18n,domain,db,auth,api,realtime,observability}
supabase/{migrations,seed.sql,config.toml,templates}
docs/{adr,architecture,runbooks}   infra/ = boundary contracts only (no real AWS)
tests/integration              RLS + storage gates (need the stack running)
```
Path alias `@/*` → `src/*` in each app. Internal deps use `workspace:*`.

## Commands
```
pnpm dev | build | lint | typecheck | test | test:e2e
pnpm db:generate | db:migrate | db:seed
pnpm supabase:start | supabase:stop | supabase:reset | supabase:status
```
Before declaring work done, run: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.

## Conventions
- TypeScript strict; prefer `type`-only imports; no `any` (warn-enforced).
- Server-only modules import `server-only`; never leak secrets to client bundles.
- Every async screen needs intentional loading / empty / error states (no white
  screens — there are error/loading/not-found boundaries already).
- Add tests with behavior changes: unit (`packages/*`), RLS/storage integration
  (`tests/integration/`), component (`apps/*/src/__tests__`), e2e (`apps/web/e2e`).
- tRPC routers live in `packages/api/src/routers`. Keep the procedure tiers.

## Local-dev gotchas (learned the hard way)
- Docker **engine** must be running or `supabase:start` hangs (`docker ps` hangs
  too). Newer Supabase CLIs use **Mailpit** (not Inbucket) at :54324 and the new
  **`sb_publishable_` / `sb_secret_`** key format — map them to
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`.
- OTP emails are forced to contain the 6-digit code via `supabase/templates/*.html`
  (wired in `config.toml [auth.email.template.*]`). Changing them needs a stack
  restart.
- `.env` lives at the repo root; both apps load it via `dotenv` in `next.config.mjs`.

## Out of scope this milestone
Listing wizard, marketplace/browse, offers/counter-offers UX, transactions UX,
durable jobs, full admin surface, any AWS provisioning, the demo-auth fallback
(disabled by default — ADR-0007). The full plan is in the technical plan document;
section 6A corrections govern.
