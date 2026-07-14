# ADR-0021 — Persisted milestone/task model (Week 5)

## Status
Accepted (Week 5).

## Context
Deriving the whole UI from one status field cannot express "who must do what next" or partial
per-participant progress.

## Decision
Persist **17 tasks over 6 stages** (`transaction_tasks`) with `(code, stage, sequence,
assigned_actor, required, status)`. The financing task is `required` only for the FINANCING
route (else `SKIPPED`). The active stage is derived from the first open required task; status +
`next_actor` (`BUYER/SELLER/BOTH/SYSTEM/NONE`) are recomputed from open tasks after every
completion (`tx_recompute`). Task statuses: `PENDING/ACTION_REQUIRED/IN_PROGRESS/COMPLETED_DEMO/
BLOCKED/FAILED/SKIPPED`. Progress = completed required non-skipped tasks / all such tasks.

## Consequences
The UI shows per-actor ownership and accurate progress; server transitions stay authoritative.
Raw task codes/enums are mapped to i18n keys, never shown. See ADR-0019.
