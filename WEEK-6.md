# WEEK 6 — Admin Portal & Operational Controls

The separate **operations portal** (`apps/admin`, port 3001) that lets a single ADMIN
oversee and, where necessary, recover the customer marketplace — **without ever acting
as a customer**. Everything an admin can *do* is a narrow, reason-coded, audited,
server-authoritative capability. Customer workflows were **not** redesigned; the admin
app reads the same canonical tables through admin RLS and writes only through
`SECURITY DEFINER` functions.

## Hard rules honoured (spec §1–§6)
- **Two account types only** (`CUSTOMER`, `ADMIN`). No impersonation, no "act as buyer/seller",
  no admin-authored offers/listings/transactions.
- **Immutable identity & history**: admins can never alter a proposal amount, an accepted
  offer, a transaction's immutable facts, or any `audit_events` row (grant-level immutability).
- **Admin app stays separate** — the customer app exposes no admin route, link, or nav.
- **Capabilities are server-authoritative** — the prototype ADMIN holds all 16, but every
  procedure re-checks the capability server-side; the UI only *reflects* what the server allows.
- **No shared demo seed** — tests provision their own principals.

## What was built

### Phase A — Data & capability engine (migrations `…0812`, `…0813`)
- **Restriction** is a two-state account flag (`ACTIVE` / `ACTIONS_RESTRICTED`) on `profiles`
  (`restricted_at`, `restriction_reason`, `restricted_by`), guarded by `guard_profile_restriction()`
  so only a `SECURITY DEFINER` admin function can set it. `is_restricted(uid)` is folded into
  every offer/listing/publication write function → `ACCOUNT_RESTRICTED`. Restriction does **not**
  block sign-in, browsing, or public listings.
- **Progression pause** on `transactions` (`progression_paused_at`, `progression_pause_reason`);
  `tx_lock` raises `PROGRESSION_PAUSED` so no milestone advances while paused.
- **Admin notes** — append-only `admin_notes` (category enum, 3–1000 char body, nullable
  `created_by_admin_id ON DELETE SET NULL`, admin-only RLS). Notes supersede; never edit.
- **`audit_events` immutability** — `revoke update, delete, truncate … from authenticated`
  (grant-level, so even an RLS-passing admin cannot mutate history).
- **13 admin `SECURITY DEFINER` functions**, each `is_admin()`-gated and writing an audit row:
  restrict/restore customer, pause/resume listing, retry verification, close offer thread,
  pause/resume/retry-step/mark-failed/resolve-cancellation transaction, record document access,
  add note. Enum CASE assignments use explicit `::enum` casts (the recurring Week-4/5/6 gotcha).
- **16 capabilities** (`packages/domain/src/admin.ts`) with reason enums for every controlled
  action; `PROTOTYPE_ADMIN_CAPABILITIES` = all 16; `hasCapability` is the single check.

### Phase B — Admin API (`packages/api`)
- `adminCapabilityProcedure(cap)` (`packages/api/src/trpc.ts`) → `FORBIDDEN 'CAPABILITY_REQUIRED'`.
- `adminRouter` with 11 sub-routers (overview, search, customers, notes, listings, publication,
  verifications, offers, transactions, audit, documents) — reads via `ctx.tx` under admin RLS,
  writes via the admin SQL functions, publication approve reuses the canonical Week-3
  `PublicationReviewService.resolve`.
- **Privacy projections** (`admin-projection.ts`) — explicit allow-list mapping: masked emails,
  audit metadata allow-list (never tokens/paths/signed URLs/raw errors), document metadata with
  **no storage path**. Even admin responses avoid unnecessary identity.
- Document access records the audit event **before** minting a 300s signed URL.

### Phase C — Admin UI (`apps/admin`)
- **8 fixed nav areas** (spec §8) = **15 operational routes** under `[locale]/(portal)` — Overview
  (1, no detail) + the 7 other areas × (list + detail) = 15 — plus the root `[locale]/page.tsx`
  redirect to `/overview` (16 page files total) and the separate `(auth)` routes.
- Shared kit (`components/admin/`): responsive **data-table** (desktop table → mobile record
  cards, no bulk actions), **status badges** (text + icon, never colour-only), **action-dialog
  shell** + **reason selector** (no hidden default) powering all controlled actions,
  **notes panel**, audited **document-access** dialog (purpose + acknowledgement), **global
  search** combobox, **filter tabs** + **pagination** (URL state), public/private **data sections**.
- **i18n**: 446 nested `admin.*` keys, **EN/AR parity exact**; Arabic is **draft/unreviewed**.
- **a11y/RTL**: skip link, `aria-current`, semantic tables + captions, LTR-safe references/amounts,
  RTL logical properties + mirrored chevrons.

## Final routes (`apps/admin/[locale]/(portal)`)
`/overview` · `/customers` `/customers/[customerId]` · `/listings` `/listings/[listingId]` ·
`/publication` `/publication/[publicationRequestId]` · `/offers` `/offers/[offerThreadId]` ·
`/transactions` `/transactions/[transactionId]` · `/verifications` `/verifications/[verificationId]` ·
`/audit` `/audit/[auditEventId]`. Utilities: global search (header), language, admin account, sign-out.

## Capabilities (16, server-authoritative)
`VIEW_OVERVIEW`, `VIEW_CUSTOMERS`, `MANAGE_CUSTOMER_STATUS`, `VIEW_LISTINGS`, `REVIEW_PUBLICATION`,
`MANAGE_LISTING_AVAILABILITY`, `VIEW_OFFERS`, `CLOSE_INVALID_OFFER`, `VIEW_TRANSACTIONS`,
`MANAGE_TRANSACTION_RECOVERY`, `VIEW_VERIFICATIONS`, `RETRY_SIMULATION`,
`VIEW_PRIVATE_DOCUMENT_METADATA`, `ACCESS_PRIVATE_DOCUMENT`, `VIEW_AUDIT_LOGS`, `ADD_ADMIN_NOTES`.

## Tests & verification
- **Integration (`tests/integration/admin.test.ts`, 10 tests)** — admin access + notes;
  restriction blocks new offers, `ALREADY_RESTRICTED`, restore; listing pause/resume; offer close
  keeps proposals immutable; transaction pause (`PROGRESSION_PAUSED`)/resume/mark-failed;
  immutability (admin cannot change proposal/accepted amount or an audit row); document-access
  **phased lifecycle** (REQUESTED/GRANTED/FAILED) with customer denial + audit immutability. Re-run
  green against a **full fresh migration chain 0100→0815**.
- **Domain/API units** — capability + projection privacy (masking, metadata allow-list, no path).
- **Admin component tests (`apps/admin`, 14 new / 21 total)** — label maps (unknown-enum fallback,
  LTR amounts, deterministic timestamps), status badge text+icon, reason selector (no hidden
  default), action-dialog open/submit/error/disabled, detail Field null/LTR.
- **Phase D — E2E executed and green** (`apps/admin/e2e/`, full local stack): **10 E2E flows**
  (customer-denied, admin nav, restrict+restore+audit trail, publication approve, publication
  return, listing pause+resume, offer read-only immutable history, **private-document access
  (audited REQUESTED+GRANTED; customer denied)**, **transaction recovery (pause→resume, ownership
  unchanged, audited)**, audit log) + **5 axe pages** (dashboard, customer profile, publication
  review, transactions, audit) — **0 serious/critical violations**.

## Full-repository validation (whole monorepo, fresh stack 0100→0815)
Run via the documented fresh-start approach (discard volume → `supabase start` → `db:setup`):

| Command | Result |
|---|---|
| `pnpm typecheck` | **12/12 packages** ✅ |
| `pnpm lint` | **11/11 packages** ✅ |
| `pnpm test` | **258 tests, 0 failed, 0 skipped** (domain 106, web 54, integration 52, admin 21, api 14, i18n 6, auth 5; db has no test files) ✅ |
| `pnpm build` | web (64 pages) + admin (36 pages) ✅ |
| `pnpm db:setup` | env-driven admin bootstrap creates one ADMIN ✅ |
| `pnpm test:e2e` | **36/36** — web **21** + admin **15**, 0 failed, 0 skipped ✅ |

**E2E note:** the root `pnpm test:e2e` runs both apps' suites *concurrently* via turbo, which starts
two Next dev servers + two Chromium instances on top of the stack and can exhaust Docker Desktop's
memory (≈7.6 GB here) — that manifested once as two flaky timeouts and a wedged daemon. Run the
suites **serially** (web then admin) on a memory-constrained machine; both are then fully green.

## Bugs found by the E2E pass (and fixed)
Running the suite end-to-end surfaced three real defects that unit/type checks could not:
1. **`publication.returnForChanges` violated RLS** — it inserted the owner's notification through
   the admin's own RLS-bound connection (a user may only insert their *own* notifications), rolling
   the whole action back. Fixed by moving it into a `SECURITY DEFINER` function
   (`admin_return_publication`, migration `…0814`), matching every other admin action.
2. **Missing enum i18n coverage crashed pages** — `offer_proposal_status` (`CURRENT`, `CLOSED`),
   `offer_thread_status` (`DRAFT`, `AWAITING_SELLER`, `AWAITING_BUYER`), and
   `transaction_next_actor` (`BOTH`, `SYSTEM`, `NONE`) had no `admin.*` label, throwing
   `MISSING_MESSAGE`. Fixed by adding the labels **and** adding `t.has()` fallbacks so future enum
   drift degrades to the raw value instead of crashing.
3. **Disabled pagination failed colour contrast** (2.02:1) — the disabled control was a greyed
   `<span>`; changed to a real `<button disabled>` (WCAG/axe exempt disabled controls, and it
   leaves the tab order correctly).

## Closure-pass corrections (post-review)
1. **Private-document audit wording is now exact** (migration `…0815`, ADR-0027): the single
   pre-mint `ADMIN_PRIVATE_DOCUMENT_ACCESSED` event is replaced by an explicit lifecycle —
   `ADMIN_DOCUMENT_ACCESS_REQUESTED` (before mint) → `GRANTED` (mint ok) / `FAILED` (mint failed).
   The procedure **returns** (does not throw) on mint failure so the FAILED audit commits rather
   than rolling back. The URL/Storage path is never recorded. Covered by integration + E2E.
2. **Live admin queues implemented** (spec §33): `useAdminQueueChannel` subscribes to
   `listing_publication_requests` + `transactions` and refetches authoritative dashboard metrics on
   change (payload never trusted; admin RLS scopes delivery). A reconnecting/stale indicator shows
   only when unhealthy. Realtime is now **complete**, not a follow-up.
3. **Two operational E2E flows added** (see Phase D): private-document access + transaction recovery.
4. **Route count clarified**: **15 operational routes** (Overview + 7 areas × list/detail) + a root
   redirect (16 page files), not "16 routes".

## Known limitations
- **Arabic copy is machine-draft** and must not be treated as reviewed (esp. any legal/operational
  wording).
- The local Supabase CLI's `db reset` hangs on `DROP DATABASE` (a `pg_cron`/`pg_net` reconnect
  quirk in this environment); a **fresh `supabase start` on a discarded volume** applies the whole
  chain cleanly and was used to validate — avoid `db reset` locally here. Root `test:e2e` should be
  run **serially** on a memory-constrained machine (see the E2E note above).

## Closure status
**All phases A–E complete, executed, and green — closure pass done.** Full migration chain
0100→**0815** applied on a fresh stack. Whole-monorepo evidence: **typecheck 12/12 · lint 11/11 ·
258 unit/component/integration tests · web+admin build · db:setup · 36 E2E (web 21 + admin 15) + 5
axe pages — 0 failed, 0 skipped.** Four E2E-discovered/closure bugs fixed (`…0814` RLS,
`…0815` document-audit, enum i18n, contrast). Realtime queues complete. Docs delivered (this file +
`docs/architecture/admin-portal.md` + ADR-0024…0029 + CLAUDE.md).
