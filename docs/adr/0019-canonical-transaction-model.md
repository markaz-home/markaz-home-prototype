# ADR-0019 — Canonical transaction model (Week 5)

## Status

Accepted (Week 5).

## Context

Week 1 shipped an empty placeholder `transactions` table (+ `transaction_stage_history`, a
`transaction_stage` enum of `OFFER…COMPLETE_DEMO`) with a **now-broken FK** `offer_id → offers`
(the `offers` table was dropped in migration `…0804`). It had participant-read/admin-write RLS
and no state engine. Week 5 needs one canonical, secure transaction per accepted offer thread,
with persisted milestones and server-authoritative transitions.

## Decision

**Supersede** the placeholder via forward-only migrations `…0808`/`…0809`/`…0810` and build one
canonical model:

- `transactions` — one per accepted offer thread + accepted proposal, with **immutable
  identity** (thread, proposal, listing, buyer, seller, `accepted_amount_aed`, reference) via a
  guard trigger, DB-unique on `offer_thread_id` and on `accepted_proposal_id` (idempotency), and
  terminal-timestamp CHECK constraints.
- `transaction_tasks` — persisted milestones (17 tasks / 6 stages) with an assigned actor and
  status; the UI is driven by tasks, never a single status field.
- `transaction_documents` — private, participant-scoped prototype documents.
- `transaction_events` — participant-readable timeline.

All consequential writes go through **`SECURITY DEFINER` functions** (mirroring the Week-4 offer
model: RLS enabled but not forced, read-only customer grants, execute grants); the actor is
derived from `auth.uid()`. Status + `next_actor` are recomputed server-side from task state.

The old `transaction_stage`/`transaction_stage_history` and `domain/transaction.ts` stage helpers
are removed; `admin-overview.ts` metrics are repointed to the new `status` column.

## Consequences

- One canonical transaction system; no competing model or dead scaffolding.
- Idempotent creation is DB-guaranteed; duplicate `ensure_transaction` returns the existing row.
- Customers cannot forge identity/amount/status (RLS + immutability trigger); verified by
  integration tests against the live database.
- The broken `offer_id → offers` FK is eliminated.
- Related: ADR-0020 (offer→transaction relationship), ADR-0021 (milestone model),
  ADR-0022 (listing treatment on completion/cancellation), ADR-0023 (private transaction docs).
