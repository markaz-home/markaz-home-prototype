# Transactions (Week 5)

Shared, simulated transaction workspace built on an accepted Week-4 offer. Nothing is real:
no payment, escrow, contract, or DLD transfer. Governing spec:
`docs/design/transaction-tracker-design-spec.md`. Decisions: ADR-0019…0023.

## Data model (migrations `…0808`–`…0811`)
- **`transactions`** — one per accepted `(offer_thread, accepted_proposal)`. Immutable identity
  (thread, proposal, listing, buyer, seller, `accepted_amount_aed`, `reference`) guarded by
  `guard_transaction`. Unique on `offer_thread_id` and `accepted_proposal_id`. Workflow columns:
  `status`, `next_actor`, `purchase_route`, `financing_status`, `deposit_amount_aed`,
  `deposit_confirmed_at`, `transfer_preferred_date`, `transfer_appointment_at`, cancellation
  fields, `version`, terminal timestamps.
- **`transaction_tasks`** — 17 persisted milestones over 6 stages; `(code, stage, sequence,
  assigned_actor, required, status)`. Unique `(transaction_id, code)`.
- **`transaction_documents`** — private prototype files; unique active file per
  `(transaction, uploader, type)`; MIME ∈ {pdf, jpg, png}, ≤ 10 MB (CHECK constraints).
- **`transaction_events`** — participant timeline.

## State engine (SECURITY DEFINER)
`ensure_transaction` (idempotent create), `tx_complete_task` (generic participant confirmation),
`tx_select_route`, `tx_set_financing`, `tx_confirm_deposit`, `tx_run_due_diligence`,
`tx_propose_transfer_date`, `tx_create_appointment`, `tx_confirm_completion`,
`tx_request_cancellation`, `tx_resolve_cancellation` (+ helpers `tx_lock`, `tx_active_stage`,
`tx_recompute`, `tx_finalize_cancellation`). Every mutation: `tx_lock` validates participant +
expected `version` + non-terminal; the actor is derived from `auth.uid()`; task completed →
`tx_recompute` re-derives status + `next_actor` from open tasks.

- **Active stage** = the first stage with an open required non-skipped task (`tx_active_stage`);
  `INITIATED` until the first `CONFIRMATION` task completes.
- **Completion** is atomic: both completion confirmations → revalidate all required tasks →
  `COMPLETED_DEMO` + listing `SOLD_DEMO` + events + notifications.
- **Cancellation** unilateral (pre-deposit, before both details) or mutual
  (`CANCELLATION_PENDING`); final → `CANCELLED` + listing `PAUSED` (never auto-LIVE);
  `listing_has_accepted_offer` excludes cancelled transactions so a resumed listing is not
  wrongly `UNDER_OFFER`.

## RLS & security
RLS enabled, not forced (owner-run functions write; mirrors `…0805`). Customers: `grant select`
only; participant-scoped read policies; documents readable only by their uploader (+ admin).
Identity/amount immutable; customers cannot set `status`/`next_actor`. Missing == forbidden.
Verified live: unrelated customer denied, direct status/amount forgery denied, cross-actor
action denied.

## API & projection
`packages/api/src/routers/transactions.ts` — thin `customerProcedure` wrappers over the SQL
functions + reads via RLS `ctx.tx`. `packages/api/src/transaction-projection.ts` — explicit
allow-list DTOs: buyer/seller perspective, other participant's documents reduced to per-type
completeness (never filenames), no user ids/paths/contact in the DTO.

## Notifications & Realtime
Reuse `public.notifications` with `TRANSACTION_*` kinds (validated by the `toSafeNotification`
discriminated union in `packages/domain/src/notification.ts`). Realtime channel
`transaction:{id}` on `transaction_events` (participant-scoped by RLS) triggers an authoritative
tRPC refetch — the payload is never trusted (ADR-0018 pattern).

## UI
`(app)/transactions` (My Transactions) + `(app)/transactions/[transactionId]` (workspace);
`components/transactions/*`. Entry point: "Continue to transaction" on the accepted offer
(`AcceptedPanel`). Nav action badge from authoritative task state. EN/AR i18n (Arabic draft),
RTL logical properties, `dir="ltr"` for money/reference/dates.

## Simulation boundary
Approved wording only ("confirmed in demo", "completed in demo", "simulated appointment"…);
forbidden claims ("payment received", "escrow funded", "ownership transferred", "legally
completed", …) are never emitted. Disclosure shown at entry + persisted in the workspace.
