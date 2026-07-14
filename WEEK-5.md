# WEEK 5 — Accepted Offer & Transaction Tracker

Week 5 adds a **shared, secure, simulated transaction workspace** where the buyer and
seller of an accepted offer track a prototype property transaction from acceptance to a
demo completion or cancellation. Everything regulated is **simulated** — no real payment,
escrow, contract, or DLD transfer. Buyer and Seller remain *journeys* of one `CUSTOMER`
account.

Governing design: `docs/design/transaction-tracker-design-spec.md`. Decisions: ADR-0019…0023.
It **consumes** the Week-4 accepted thread + accepted proposal read-only and does not
redesign offers.

> **Status note.** Week 5 is **complete and verified against a live full stack.** The data
> model, state engine, RLS boundary, private document flow, and full lifecycle are covered by
> **13 live-DB integration tests** (create → confirm → deposit → documents → checks → transfer
> → completion → `COMPLETED_DEMO` + listing `SOLD_DEMO`; mutual cancellation → `CANCELLED` +
> listing `PAUSED`; document register/remove/privacy) and **5 Playwright E2E + 5 axe scans**
> against the running app. Typecheck, lint, build, and all 224 unit/component/integration tests
> pass; the migration chain 0100→0811 applies clean from scratch.

---

## What was built

- **Canonical transaction model** — one transaction per accepted offer thread + accepted
  proposal, with immutable identity (thread, proposal, listing, buyer, seller, amount) and a
  human reference `MKZ-TXN-{year}-{6}`. Supersedes the empty Week-1 placeholder (ADR-0019).
- **Persisted milestone/task model** — 17 tasks across 6 stages, each with an assigned actor
  and status; the UI is driven by tasks, not a single status field.
- **Server-authoritative state engine** — 12 `SECURITY DEFINER` functions hold every
  consequential transition; customers have read-only RLS.
- **Idempotent creation** — `ensure_transaction(thread)` (auto on the accepted-offer handoff),
  DB-unique per thread and per proposal.
- **Simulated flows** — details confirmation (both sides), purchase route (CASH/FINANCING),
  10% demo deposit, document checklist + demo summary review, due-diligence simulation,
  transfer date + readiness + simulated appointment, dual completion confirmation.
- **Listing treatment** — completion → listing `SOLD_DEMO`; cancellation → listing `PAUSED`
  (never auto-LIVE); cancelled transactions no longer derive `UNDER_OFFER`.
- **UI** — My Transactions dashboard + shared perspective-aware workspace (tracker,
  next-action, task list, per-stage action controls, deposit & document-upload panels, timeline,
  cancellation, and a mobile sticky action bar), the
  "Continue to transaction" handoff on the accepted offer, and a nav action badge.
- **Notifications / Realtime / audit** — reuse the canonical `notifications` table with
  `TRANSACTION_*` kinds (validated by a discriminated union); a participant-scoped
  `transaction:{id}` realtime channel drives authoritative refetch; audit events on every step.

## What was preserved

Auth, CUSTOMER/ADMIN model, listing creation, publication, marketplace, saved properties,
**all of Week-4 offers** (consumed read-only), the notifications table, the realtime
foundation, RLS identity propagation, storage privacy, EN/AR + RTL, the design system, and
every existing test suite. The only Week-4 change is extending `listing_has_accepted_offer`
to ignore cancelled transactions (spec §31).

## Final routes

| Route | Who | Purpose |
|---|---|---|
| `/[locale]/transactions` | participant | My Transactions dashboard |
| `/[locale]/transactions/[transactionId]?focus=…` | participant | Shared perspective-aware workspace |

One shared route; sub-steps are `?focus=` anchors, not separate paths (spec §13).

## Canonical transaction model (migrations `…0808`–`…0811`, ADR-0019)

Tables: `transactions`, `transaction_tasks` (milestones), `transaction_documents`,
`transaction_events`. Constraints: `uniq_transaction_per_thread`, `uniq_transaction_per_proposal`
(DB-enforced single/idempotent), `buyer <> seller`, terminal-timestamp checks, an immutable
identity guard trigger. Read-only customer grants; all writes via SECURITY DEFINER functions.

## Offer→transaction relationship (ADR-0020)

`ensure_transaction(thread)` validates the thread is `ACCEPTED`, derives buyer/seller/listing
and the accepted amount from the accepted proposal, and inserts the transaction + tasks +
`TRANSACTION_CREATED` event + notifications atomically. Idempotent: a second call (either
participant) returns the same row; the unique index is the backstop.

## State model & milestones

Statuses: `INITIATED → CONFIRMATION → DEPOSIT → DOCUMENTS → DUE_DILIGENCE → TRANSFER →
COMPLETION → COMPLETED_DEMO`, plus `CANCELLATION_PENDING`, `CANCELLED`, `FAILED` (terminal:
last three + `COMPLETED_DEMO`). The active stage is **derived from the first open required
task** (`tx_active_stage`); `tx_recompute` advances the status and recomputes `next_actor`
(`BUYER`/`SELLER`/`BOTH`/`SYSTEM`/`NONE`) from incomplete tasks. Task statuses: `PENDING`,
`ACTION_REQUIRED`, `IN_PROGRESS`, `COMPLETED_DEMO`, `BLOCKED`, `FAILED`, `SKIPPED`. Raw enums
are never shown — mapped to translation keys (`transactionStatusKey`, `taskOwnershipKey`).

## Actor / next-action rules

Server-derived only; no client-supplied status/actor. Each mutation validates participant,
expected version, actionable stage, and correct actor (`NOT_YOUR_TASK` otherwise). SYSTEM
steps (due diligence, appointment, final completion) are triggered by a participant but run
server-side.

## Single-acceptance / idempotency

`uniq_transaction_per_thread` + `uniq_transaction_per_proposal` guarantee one transaction per
accepted offer. **Verified live**: duplicate `ensure_transaction` returns the same row; a
non-participant is rejected `NOT_FOUND`; a non-accepted thread is rejected `NOT_ACCEPTED`.

## Deposit / documents / financing / due diligence / transfer / completion

- **Deposit** = 10% of accepted amount (server-computed, display-only); buyer confirms;
  "Deposit confirmed in demo — no real payment has been processed."
- **Route** CASH/FINANCING required; financing is a simple demo status; changing route is
  blocked once the demo deposit is confirmed.
- **Documents** — private, participant-scoped: the other party sees only per-type
  completeness, never filenames. A shared "Simulated transaction summary" is reviewed by both.
- **Due diligence** — a simulated checklist; "not legal, financial, structural, title, or
  regulatory advice."
- **Transfer** — seller proposes a date (3–30 days), both confirm readiness, then a simulated
  appointment ("Transfer appointment simulated — no official appointment has been booked").
- **Completion** — both confirm; the server revalidates all required milestones and
  atomically sets `COMPLETED_DEMO` + listing `SOLD_DEMO` + events + notifications.

## Listing treatment (ADR-0022)

Completion → `SOLD_DEMO` (excluded from the marketplace view, offers blocked, publication
history preserved). Cancellation → `PAUSED`; the seller must explicitly review/resume; the
cancelled transaction no longer derives `UNDER_OFFER`. **Verified live** for both.

## Cancellation & failure

Unilateral (immediate) cancellation while `INITIATED`/`CONFIRMATION` before both details
confirmations; mutual (`CANCELLATION_PENDING` → the other confirms/declines) from Deposit
onward. Structured reasons only. `FAILED` is reserved for terminal system failure (not user
cancellation). Cancellation never deletes the record. **Verified live**: mutual cancellation →
`CANCELLED` + `PAUSED`; the requester cannot resolve their own request.

## Notifications / Realtime / RLS / audit

Reuses `public.notifications` (`TRANSACTION_*` kinds via `toSafeNotification` discriminated
union). Realtime `transaction:{id}` channel → authoritative refetch; participant-scoped by
RLS; anonymous receive nothing. RLS: participants + admin read; no direct customer writes;
identity/amount immutable; **verified live** (unrelated customer denied, direct status/amount
forgery denied, cross-actor action denied). Audit events on every consequential step; no
document content/paths/identity logged.

## Tests and exact totals

| Layer | Count | Status |
|---|---|---|
| Unit (domain, incl. transaction + notification) | 101 | ✅ |
| Unit (api projection, incl. 5 transaction-privacy) | 9 | ✅ |
| Component (web, incl. 5 transactions) | 54 | ✅ |
| **Integration (live DB) — transactions** | **13** | ✅ |
| Integration (live DB) — offers (Week 4, preserved) | 29 | ✅ |
| **E2E (Playwright) — transactions** | **5** | ✅ executed |
| **Accessibility (axe) — transactions** | **5 scans** | ✅ 0 serious/critical |

`pnpm typecheck` 12/12 · `pnpm lint` 11/11 (0 warnings) · `pnpm build` web 64/64 + admin 36/36.
Full `pnpm test` (stack up): **all green** — domain 101, web 54, integration (offers 29 +
transactions 13 = 42), admin 7, i18n 6, auth 5, api 9 = **224**. E2E + axe: **21/21** across
offers + transactions run together. The full migration chain 0100→0811 applies cleanly from scratch.

E2E covers: buyer confirms details, both confirm completion → `COMPLETED_DEMO`, early
cancellation, unrelated-customer denied, My Transactions list. **Axe scans all five required
screens: My Transactions, transaction workspace, deposit simulation, document checklist, and
the completion state — 0 serious / 0 critical.**

## English / Arabic / RTL / mobile / accessibility

`transactions.*` i18n added with **exact parity — 199/199 keys EN↔AR** (validated by the
`transactions.*` subtree parity check that flattens both `packages/i18n/messages/{en,ar}.json`
and diffs the key sets; run as part of the i18n build). Arabic is **draft**, flagged for
professional legal/financial review (CLAUDE.md). Workspace uses logical CSS, `dir="auto"` on
names, `dir="ltr"` on amounts/reference/dates; responsive two-column → single-column layout; a
**mobile sticky action bar** surfaces the participant's next action on small screens (48 px
target, safe-area padding, `lg:hidden`, and bottom padding so it never covers the timeline);
progress tracker is an ordered list with `aria-current="step"`; `role="status"` next-action;
labeled controls.

## Documents (Phase C — complete)

Private `transaction-documents` bucket + participant-scoped storage RLS (migration `…0808`);
`tx_register_document`/`tx_remove_document` SECURITY DEFINER functions (migration `…0811`)
validate the participant, the document type belongs to their side, MIME/size, and a
`${transactionId}/${uploaderId}/…` object key (no cross-transaction registration). The
document-checklist task is **gated** on the participant's required fictional identity file.
Signed URLs are short-lived (60 s), uploader/admin-only, minted via the service-role
`transactionDocumentSignedUrl`. The upload control (`document-checklist.tsx`) uploads the
fictional file to the private bucket, then registers it. **Verified live**: register/remove,
cross-transaction path rejected, wrong-side type rejected, non-participant rejected, and a
document row is private to its uploader.

## Test data strategy (no shared demo seed)

**No shared Week-5 demo seed was introduced.** Unit tests use inline fixtures/factories;
integration and E2E tests create their own isolated accepted-offer + transaction data per test
(`acceptedTransaction`/`driveTo*` helpers) and do not depend on any permanent seeded
transaction scenario. `supabase/seed.sql` and `pnpm db:setup` are unchanged — basic system
users / foundational setup records remain fine; no accepted/cancelled/failed/completed
transaction examples were added to a seed.

## Known limitations

- **Functional responsive experience is complete**, including the mobile sticky action bar and
  the essential design-spec components (handoff panel, perspective badge, simulation disclosure,
  stage progress tracker, next-action panel, demo-deposit card, document checklist/upload, demo
  summary/checks, readiness control, cancellation dialog, transaction timeline, realtime banner,
  mobile action bar). **Remaining is fine visual polish** (pixel-level styling of the full §37
  component gallery), explicitly **deferred to Week-7 hardening** — it does not block Week-6 Admin.
- **Architecture docs**: `docs/architecture/transactions.md` is provided (covering state
  machine, security, documents, and realtime); dedicated `transaction-state-machine.md`/
  `transaction-security.md`/`transaction-documents.md`/`transaction-realtime.md` files are
  summarised there and in ADRs rather than split out.
- Arabic copy is draft; `FAILED` has no automatic trigger (reserved for a future job/Admin).

## Week 6 readiness

The transaction schema, state engine, RLS, and audit are stable and admin-ready: admin metrics
already count active/failed/completed transactions; `FAILED`/future-review copy anticipates the
Week-6 Admin Portal. No transaction-system restructuring is required to add Admin.

## Final acceptance checklist (evidence-backed)

| Criterion | State |
|---|---|
| Accepted offer creates one transaction; exact accepted proposal | ✅ integration |
| Duplicate creation impossible (idempotent) | ✅ unique indexes + integration |
| Buyer & seller access shared workspace; unrelated denied | ✅ RLS integration |
| Server-authoritative stages; persisted milestone; correct next actor | ✅ integration |
| Deposit simulation without real payment | ✅ |
| Document checklist + upload works; documents private (participant-scoped) | ✅ integration + E2E |
| Due-diligence / financing / transfer simulations | ✅ |
| Completion blocked until requirements met; `COMPLETED_DEMO` | ✅ integration + E2E |
| Cancellation works; listing PAUSED after cancel; SOLD_DEMO after completion | ✅ integration + E2E |
| Notifications reuse canonical table; realtime participant-scoped | ✅ |
| No legal/payment claims; approved simulation wording | ✅ i18n copy |
| English / Arabic / RTL / mobile (incl. sticky action bar) | ✅ built + parity 199/199 |
| No shared demo seed; isolated test data | ✅ |
| Week 1–4 tests remain green; lint/typecheck/build pass | ✅ |
| E2E / axe pass | ✅ 5 E2E + 5 axe (0 serious / 0 critical) |

## Closure status

- **Core transaction feature:** Complete
- **Transaction architecture:** Complete
- **Security and privacy:** Complete
- **Week-5 automated validation:** Complete (224 unit/component/integration + 21 E2E/axe)
- **Final visual polish:** Functional responsive experience + mobile action bar complete;
  pixel-level §37 gallery polish deferred to Week-7 hardening
- **Ready for Week-6 Admin Portal:** Yes — `SOLD_DEMO` and cancellation→`PAUSED` are documented
  in ADR-0022, so no redesign is needed before Admin work begins.
| `WEEK-5.md` accurate; ready for Week 6 without restructuring | ✅ |
