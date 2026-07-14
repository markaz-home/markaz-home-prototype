# AGENTS.md — MARKAZ Home

Guidance for Codex working in this repo. Read before making changes.

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
- **Auth is email + password** (Supabase `signInWithPassword`). A **6-digit email
  code** verifies a new account (`verifyOtp type:signup`); **password recovery uses
  the official Supabase LINK** (`resetPasswordForEmail` → email link → `/auth/confirm`
  route handler runs `verifyOtp({ type:'recovery', token_hash })` → reset-password →
  `updateUser` → sign out → fresh sign-in). **Never** build, store, or log any code,
  password hash, or token — Supabase Auth owns them all (ADR-0009).
- **Auth/onboarding UI follows `docs/design/auth-onboarding-design-spec.md`**: split
  AuthShell (header w/ language switcher + footer + support panel), 3-step progress,
  6-cell verification code (one logical input), the full screen inventory (check-email,
  verify success, recovery-sent, password-updated, signed-out, session-expired, error
  panels), and the Operations shell for admin. Reuse `components/auth/*`.
- **Routing gates on email verification first**: `resolvePostAuthDestination({
  emailVerified, profile })` → verify-email → profile-setup (fallback) → uae-pass
  → dashboard; unverified/incomplete customers never reach the dashboard.
  `requireCustomerStep` enforces it server-side.
- **No public admin sign-up.** Admins are created **only** by the env-driven admin
  bootstrap (`pnpm db:setup` with `BOOTSTRAP_ADMIN_EMAIL`/`BOOTSTRAP_ADMIN_PASSWORD`,
  Supabase Admin API); the admin app requires `account_type === 'ADMIN'` or shows
  access-denied. **Customers are never seeded — they sign up through the app** (the
  `handle_new_user` trigger creates each `profiles` row), so a deployment works with
  real accounts and needs no demo data.
- **Password policy:** min 8; upper, lower, number, special; **max 128** (design
  spec §10.5) — enforced in the client form and the zod schema
  (`packages/domain/src/auth.ts`). The pinned local Supabase CLI rejects
  password-policy config keys, so the deployed platform owns the server-side GoTrue
  policy.
- **Duplicate-email is anti-enumeration:** handle BOTH provider behaviours —
  `isLikelyExistingAccount` (signUp returns empty `identities[]`/no error) AND
  `isExistingAccountError` (an explicit 422 `user_already_exists`, which this
  GoTrue returns). Either → show safe Sign In / Forgot Password copy. No existence
  query, no enumeration endpoint, no raw DB errors. Bad sign-in credentials get one
  generic message.

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
  Seed (`supabase/seed.sql`) runs **after** migrations and is **minimal**. **No demo
  customers/data are seeded** — customers sign up through the app. `pnpm db:setup`
  (`setup-demo.ts`) is an **optional, env-driven admin bootstrap** only: with
  `BOOTSTRAP_ADMIN_EMAIL`/`BOOTSTRAP_ADMIN_PASSWORD` it creates one ADMIN via the
  Supabase Admin API (writing Auth tables via SQL is unsupported); with no env it is a
  no-op. Local flow: `pnpm supabase:reset` (then sign up in the app; run `pnpm db:setup`
  only if you want an admin). Idempotent. See ADR-0003 / ADR-0009.
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

## Auth flow architecture (routes, layouts, sessions — keep it stable)
- **Route groups + persistent chrome.** Auth/onboarding screens live under
  `apps/web/src/app/[locale]/(auth)/` with a **shared layout** that renders the
  chrome ONCE (header + language switcher + footer; admin: the deep-blue Operations
  band). The dashboard/app lives under `[locale]/(app)/` (CustomerNav). Route groups
  don't change URLs. `AuthShell`/`AdminAuthShell` render ONLY inner content — do NOT
  re-add per-page header/footer or a full-screen `[locale]/loading.tsx` spinner;
  both caused the "glitch on every screen". (`(app)` keeps its skeleton loading.)
- **Session loading is lean + request-deduped.** Use `getSession()` (web) /
  `getAdminSession()` (admin) from `src/server/session.ts` — they're wrapped in
  React `cache()` and read the profile directly under RLS via
  `loadOwnProfileRow` (`@markaz/db`). Do NOT load the session through the tRPC stack
  and do NOT call it redundantly (layout guard + page share one auth check + one
  query per request). `requireCustomerStep`/`requireAdmin` are the page guards.
- **No `router.refresh()` after a navigation.** `router.replace`/`push` to a dynamic
  route already reads fresh cookies; an extra `refresh()` forces a second full render
  (visible flicker). Only refresh when staying on the same route.
- Recovery uses the **link** flow; `/auth/confirm` route handlers (top-level, outside
  `[locale]`) verify the token. Middleware excludes `/auth` from locale routing.

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
pnpm db:generate | db:migrate | db:seed | db:setup
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
- Email templates are split by purpose (wired in `config.toml
  [auth.email.template.*]`): `confirmation.html` forces the **6-digit code**
  (`{{ .Token }}`) for new-account verification; `recovery.html` forces the
  **official recovery link** (`{{ .RedirectTo }}/auth/confirm?token_hash=…&type=recovery`)
  for Forgot/Reset password. `enable_confirmations = true`. Changing templates
  needs a stack restart. Tests read the **code** (verification) and the **link**
  (recovery) from the Mailpit API.
- `.env` lives at the repo root; both apps load it via `dotenv` in `next.config.mjs`.

## Listing journey (Week 2 — built)
The customer listing wizard `DRAFT → READY_TO_PUBLISH` is implemented under
`apps/web/[locale]/(app)/sell/*` (My Listings + 9 steps + ready + owner preview),
backed by `packages/api` `listing` router + `services/simulation.ts`, domain logic
in `packages/domain` (`listing.ts`/`listing-progress.ts`/`investment.ts`/
`listing-validation.ts`), and migration `…0700`. It must **not** publish to `LIVE`.
Failures keep the listing recoverable (record `FAILED_DEMO`; never `REJECTED`);
readiness is server-computed (ADR-0010). Draft photos use the **private**
`listing-photos-draft` bucket + signed URLs (ADR-0011). See `WEEK-2.md` and
`docs/architecture/property-listing.md` / `listing-state-machine.md` /
`listing-storage.md`.

## Publication + marketplace (Week 3 — built)
`READY_TO_PUBLISH → simulated review → LIVE` (then `LIVE ↔ PAUSED`) plus a public
customer marketplace. Review is a **separate** `listing_publication_requests` table
(NOT a listing-enum state). **Publication is an idempotent, compensated workflow —
Storage and Postgres do NOT share one cross-system transaction:** a stable
`public_id` is fixed at submit (deterministic photo keys `${publicId}/${photoId}`);
the §4.4 gate is re-validated at resolve; Phase 1 copies+verifies public photos
(service-role) with **compensation** on failure (remove objects, clear `public_path`,
`PHOTO_PROCESSING_FAILED`, retryable); Phase 2 is the **atomic database LIVE
transition** (one Postgres tx); a DB failure after Phase 1 compensates and leaves the
request retryable. Retries re-copy to the same keys (no dupes); re-resolve after
success is a no-op (ADR-0012). **Public-photo writes are server-only:** the public
`listing-photos` bucket is customer **read-only** (writes only via the service-role
pipeline `packages/db/src/storage-admin.ts`); `property_photos.public_path` is
trigger-guarded (`guard_public_photo_path` blocks `authenticated`/`anon`) and written
only via the elevated `postgres` connection — never customer-supplied (migration
`…0803`). **Self-save / non-LIVE-save / cross-user saves are blocked by RLS**
(`saved_properties` per-command `WITH CHECK` requires LIVE + `owner_id <> auth.uid()`),
not API-only. The marketplace reads **only** the security-barrier `marketplace_listings`
view (sole public source; §37 allowlist), never raw tables; `publicTxProcedure` serves
anon-or-authed via `withAnonContext`/`withUserContext`; a `public_id is not null` guard
keeps half-published rows out (ADR-0013). Public DTOs use **explicit allow-list
mapping** (`packages/api/src/public-projection.ts`) — never delete-fields-from-a-row.
UI: `(public)/properties` (browse + `[publicId]/[slug]` detail), `(app)/saved-properties`,
`(app)/sell/listings/[id]/{publish,publication,manage}`; anonymous Save uses a
short-lived sessionStorage intent + post-auth return (§28). Publication, save, pause,
and resume are **persisted writes** (the marketplace is not read-only). Material vs
non-material live edits per §17.4. See `WEEK-3.md`, `docs/design/publication-design-spec.md`,
`docs/architecture/{marketplace,public-listing-projection,publication-flow,listing-storage}.md`.

## Offers + negotiation (Week 4 — built)
A complete, **non-binding** buyer-offer / seller-offer-management journey between
`CUSTOMER`s on `LIVE` listings (Buyer/Seller stay *journeys*, not roles). One **thread per
(buyer, listing)** holds an **immutable chronological sequence of proposals** with an
explicit `next_actor`; counters create new proposal rows — never overwrite. Migration
`…0804` **replaced** the Week-1 flat `offers`/`counter_offers` stub (ADR-0014) with
`offer_threads`/`offer_proposals`/`offer_events`; **reuses** the generic `notifications` +
`audit_events` tables (no parallel systems). **Customers have read-only RLS on the offer
tables — every write goes through `SECURITY DEFINER` SQL functions** (`create_offer`,
`submit_counter`, `accept_offer`, `reject_offer`, `withdraw_offer`, `close_listing_offers`,
`expire_due_offers`) that derive the actor from `auth.uid()` and `created_by_side` from
membership; anon has no access; cross-buyer/cross-seller reads denied; missing == forbidden
("This offer is not available"). **Single accepted offer is DB-enforced** (partial unique
index + locked `accept_offer` that atomically closes other threads → `CLOSED_OTHER_ACCEPTED`;
ADR-0015). **`UNDER_OFFER` is derived** from an accepted offer on a still-`LIVE` listing —
NOT a publication state (ADR-0016). The **seller threshold (`min_notification_price`) stays
private** — classified server-side; the buyer DTO has no threshold field; below-threshold
offers persist but raise no prominent notification (§27). Expiry is server-authoritative,
processed lazily on read (`expire_due_offers`; ADR-0017). Realtime (`useOfferThreadChannel`)
**refetches authoritative state** on `offer_events`; RLS scopes delivery to participants
(ADR-0018). Public DTOs use explicit allow-list mapping (`packages/api/src/offer-projection.ts`).
UI: `(public)/properties/[publicId]/[slug]/offer`, `(app)/offers` (made/received tabs),
`(app)/offers/[offerThreadId]` (shared perspective-aware thread + semantic timeline, no
chat), `(app)/sell/listings/[listingId]/offers`; anonymous Make-an-Offer reuses the
save-intent pattern (`lib/offer-intent.ts`). Acceptance reaches `ACCEPTED` + a **Week-5
handoff only** — no transaction/payment/legal/contact UI. See `WEEK-4.md`,
`docs/design/offers-design-spec.md`, `docs/architecture/{offers,offer-state-machine,
offer-realtime,offer-security}.md`, ADR-0014…0018.

## Transactions (Week 5 — built)
A **shared, simulated** transaction workspace on an accepted offer. Everything regulated is
SIMULATED — **no** real payment/escrow/contract/DLD. Migrations `…0808`–`…0811`
**superseded** the empty Week-1 placeholder (ADR-0019; it had a broken `offer_id → offers` FK)
with one canonical **transaction per accepted `(offer_thread, accepted_proposal)`** —
`transactions` + `transaction_tasks` (17 milestones / 6 stages) + `transaction_documents`
(private) + `transaction_events`. **Immutable identity** (thread/proposal/listing/buyer/seller/
amount/reference `MKZ-TXN-{yr}-{6}`) via `guard_transaction`; DB-unique per thread AND per
proposal (idempotent creation). **Customers read-only via RLS — every write goes through
`SECURITY DEFINER` functions** (`ensure_transaction`, `tx_complete_task`, `tx_select_route`,
`tx_set_financing`, `tx_confirm_deposit`, `tx_run_due_diligence`, `tx_propose_transfer_date`,
`tx_create_appointment`, `tx_confirm_completion`, `tx_request_cancellation`,
`tx_resolve_cancellation`) that derive the actor from `auth.uid()`, validate `expected version`,
and recompute `status`+`next_actor` from open tasks (`tx_recompute`/`tx_active_stage`). States
`INITIATED→CONFIRMATION→DEPOSIT→DOCUMENTS→DUE_DILIGENCE→TRANSFER→COMPLETION→COMPLETED_DEMO` +
`CANCELLATION_PENDING`/`CANCELLED`/`FAILED`. **Deposit = 10% display-only** (no payment fields).
**Completion is atomic**: both confirm → `COMPLETED_DEMO` + listing **`SOLD_DEMO`**. **Cancellation**
→ listing **`PAUSED`** (never auto-LIVE); `listing_has_accepted_offer` now excludes cancelled
transactions so a resumed listing isn't wrongly `UNDER_OFFER`. Reuses `public.notifications`
(`TRANSACTION_*` kinds, discriminated-union validated) + a participant-scoped `transaction:{id}`
realtime channel (authoritative refetch). Raw enums never shown — mapped to i18n keys
(`transactions.*`, EN/AR parity; **Arabic is draft**). Approved simulation wording only — never
"payment received"/"escrow"/"ownership transferred"/"legally completed". UI: `(app)/transactions`
(My Transactions) + `(app)/transactions/[transactionId]` (shared perspective-aware workspace);
"Continue to transaction" handoff on the accepted offer. **Known gaps**: document file-upload
API/control, Playwright E2E, axe. See `WEEK-5.md`, `docs/design/transaction-tracker-design-spec.md`,
`docs/architecture/transactions.md`, ADR-0019…0023.

## Out of scope (next milestone+)
Durable jobs, full admin surface (Week 6), any AWS provisioning,
real DLD/Trakheesi/Madmoun/payment integrations, free-form messaging/chat, contact
exchange, email/SMS/push delivery, map search, the demo-auth fallback (disabled by default
— ADR-0007). The full plan is in the technical plan document; section 6A corrections govern.
