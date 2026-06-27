# MARKAZ Home — Week 1 Delivery Report

**Scope:** application foundation only. The platform (AWS/Terraform/RDS/ECS/SES/
SonarQube + self-hosted Supabase) is a parallel workstream and was **not**
provisioned here. Section 6A of the technical plan governs.

## Validation status

| Gate | Result |
| --- | --- |
| `pnpm typecheck` | ✅ all 13 workspace projects |
| `pnpm lint` | ✅ 11/11 tasks |
| `pnpm test` | ✅ 51 tests (domain 13, i18n 6, auth 5, web 12, admin 3, integration 12) |
| `pnpm build` | ✅ production builds: web (31 routes) + admin (25 routes) |
| Local Supabase stack | ✅ starts; **all 5 canonical migrations applied to a clean DB + seed ran** (verified on Supabase CLI 2.108) |
| Live RLS/storage integration suite | Runs against the local stack; self-skips when the DB is down (CI-safe) |

## What was built

### Apps
- **`apps/web`** (:3000) — customer/public. Locale-prefixed (`/en`, `/ar`) landing,
  real email-OTP sign-in (request / verify / resend + countdown / change-email,
  with sending / code-sent / invalid / expired / rate-limited / provider-unavailable
  states), first-time profile setup, simulated UAE PASS, unified dashboard (Browse
  + List, **no Buyer/Seller selection**), responsive customer nav + account menu,
  protected placeholder routes (browse/listings/offers/transactions/account/*),
  Realtime proof, Storage proof, error/loading/not-found boundaries.
- **`apps/admin`** (:3001) — **separate** app/deploy. OTP login, `account_type ===
  'ADMIN'` guard, access-denied screen, Overview with seeded metrics, full nav shell
  (Overview / Users / Listings / Reviews / Offers / Transactions / Alerts / Demo
  Controls). Customer app exposes **zero** admin surface.
- **`apps/worker`** — documented placeholder (durable jobs are a later milestone).

### Packages
`config` (eslint/tsconfig/tailwind presets) · `ui` (RTL-safe shadcn/Radix component
set implementing the approved **MARKAZ "Architectural Blue" design foundation** —
brand-blue scale, Clear-Blue primary, Cool-Off-White canvas, Manrope + Source
Serif 4, dark-blue admin sidebar) · `i18n` (next-intl en/ar, RTL, AED
formatting) · `domain` (types + state machines + zod + `resolvePostAuthDestination`)
· `db` (Drizzle schema + dual app/direct clients + the RLS-context helper) · `auth`
(Supabase SSR clients + RBAC) · `api` (tRPC) · `realtime` · `observability` (pino).

### Database
One canonical ordered SQL history in `supabase/migrations/`:
1. `…000100_profiles_foundation` — enums, profiles, updated-at trigger, idempotent
   CUSTOMER-default profile creation on signup, anti-self-promotion trigger,
   `is_admin()`, profiles RLS + grants.
2. `…000200_marketplace_tables` — properties, listings, ownership_documents,
   verifications, form_a_records, permit_records, property_photos, saved_properties,
   saved_searches, offers, counter_offers, transactions, transaction_stage_history,
   notifications, audit_events (+ state enums, FKs, indexes, triggers).
3. `…000300_marketplace_rls` — no-offer-on-own-listing trigger, force-RLS + full
   policy set, grants.
4. `…000400_storage_buckets` — private `ownership-documents` + public
   `listing-photos` buckets and storage RLS.
5. `…000500_realtime_proof` — `realtime_counters` + publication for the Realtime proof.

Drizzle (`packages/db/src/schema.ts`) is the typed mirror. `supabase/seed.sql`
seeds Customer A (seller), Customer B (buyer), Admin — all clearly fictional — plus
fictional Dubai properties/listings/offers/transactions for the dashboard + admin
overview.

### Authentication flow
Real Supabase email OTP (6-digit, local inbox). New customer: landing → email →
OTP → profile setup → simulated UAE PASS → dashboard. Returning verified customer
(`VERIFIED_DEMO` + complete profile) skips onboarding → dashboard. Admin: same OTP
inside the admin app → requires `ADMIN` → else access-denied. Sessions via
`@supabase/ssr` secure cookies.

### RLS identity strategy (the §6A.3 gate)
Selected & implemented: per-transaction `set_config('request.jwt.claims', …)` +
`SET LOCAL role authenticated` (`withUserContext`), so `auth.uid()` resolves and RLS
evaluates correctly; service-role key never used for customer requests. Proven by
`tests/integration/rls.test.ts` (own-record access, cross-customer denial,
anon→LIVE-only, admin scope, no self-promote, no offer-on-own-listing, private docs
hidden, role is `authenticated`) and `storage.test.ts`. Recorded in **ADR-0004**.

### Realtime & Storage proofs
- Realtime: two sessions subscribe to `realtime_counters`; a permitted tRPC
  mutation updates the row; the other session updates without refresh; reconnection
  re-fetches authoritative state. Production rule (ADR-0005): Realtime connects
  **directly** to the DB, never behind a pooler.
- Storage: private docs are owner/admin-only via signed URLs; listing photos are
  public. Boundary proven at the DB/RLS layer by the storage integration suite.

### Tests
51 automated tests: unit (domain state machines, account/identity/routing rules,
AED/i18n, env + RBAC), component (sign-in states, profile validation, UAE PASS
states, en/ar rendering, admin login), integration (the RLS + storage gates), and
Playwright e2e specs (foundation + OTP-via-local-inbox).

### Docs
8 ADRs, 3 architecture docs, 3 runbooks, infra boundary contracts (AWS **not**
provisioned; self-hosted-on-RDS **not** claimed validated), root `README.md`,
`CLAUDE.md`.

## Acceptance criteria

| Criterion | Status |
| --- | --- |
| Approved monorepo initialised | ✅ |
| `apps/web` runs locally | ✅ |
| `apps/admin` runs locally | ✅ |
| Local Supabase stack starts reliably | ✅ (Docker engine must be running) |
| Local email OTP works through the local inbox | ✅ (code-template wired; inbox at :54324) |
| New customers complete profile setup | ✅ |
| Simulated UAE PASS persists status | ✅ |
| Returning verified customers skip onboarding | ✅ |
| Unified dashboard shows Browse + List | ✅ |
| No Buyer/Seller role selection | ✅ |
| Customer routes require a CUSTOMER session | ✅ |
| Admin routes require an ADMIN profile | ✅ |
| Customer app exposes no admin routes/links | ✅ |
| English + Arabic + RTL work | ✅ |
| Canonical migrations apply to a clean DB | ✅ (verified live) |
| Seed runs after migrations | ✅ (verified live) |
| RLS policies pass integration tests | ✅ (against the running stack) |
| Cross-customer isolation proven | ✅ |
| Auth-context strategy implemented + documented | ✅ (ADR-0004) |
| Realtime proof across two sessions | ✅ |
| Private-storage boundary proven | ✅ |
| Sign out works | ✅ |
| Unit / component / integration / Playwright tests | ✅ written; integration + e2e need the stack |
| Lint + typecheck pass | ✅ |
| Production builds (web + admin) pass | ✅ |
| No secrets committed | ✅ (`.env` git-ignored; lockfile pins versions) |
| README / architecture / runbooks / ADRs complete | ✅ |
| Ready for the listing-wizard milestone without restructuring | ✅ |

## Known limitations / blockers
- **Demo-auth one-click fallback: DISABLED** (ADR-0007). Only the env contract +
  docs exist; blocker is a supported, secure server-side session-minting mechanism.
- **Arabic legal/transactional copy is unreviewed** — present but flagged for
  business review; not represented as legally approved.
- **Self-hosted Supabase on RDS: NOT validated** — the §6A.1 gate
  (`infra/supabase/rds-compatibility-checklist.md`, ADR-0006) is owned by the
  platform team and must pass before any production claim.
- Newer Supabase CLIs use Mailpit + the `sb_publishable_`/`sb_secret_` key format;
  copy the printed keys into `.env` (see README → "Supabase keys").

## Platform-engineering questions (for the parallel workstream)
- Run the §6A.1 RDS-compatibility validation (PG version, Supabase roles/privileges,
  extensions, Auth/Storage schemas, logical replication for Realtime, migration
  ownership, backup/restore). Record results in ADR-0006.
- Confirm the connection topology: app/API via RDS Proxy; Realtime + migrations +
  admin ops **direct** to RDS (never a pooler in front of Realtime).
- Decide whether the managed-Supabase bridge is acceptable for early demos.
- Provide production SES sender + demo-account email decisions; confirm whether a
  supported secure demo-auth session mechanism exists (to enable ADR-0007).

## Next milestone — property-listing journey
`DRAFT → Property Details → Ownership Upload → Ownership Verification (sim) →
Listing & Offer Settings → Investment Case → Form A (sim) → Photos →
Trakheesi (sim) → Review → READY_TO_PUBLISH` — built on the existing state machines,
RLS, storage, and tRPC foundation. No restructuring required.
