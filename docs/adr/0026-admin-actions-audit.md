# ADR-0026 — Reason-coded, audited admin actions (Week 6)

## Status
Accepted (Week 6).

## Context
Every admin mutation must be attributable, explained, and tamper-evident, and must never
let an admin act as a customer or alter immutable history.

## Decision
Each action is: capability-gated → parameterised by a **closed reason enum** (no free-text
authority, no hidden default in the selector) → executed by an `is_admin()`-gated SECURITY
DEFINER function that re-derives the actor from `auth.uid()`, validates state, and writes an
`audit_events` row. Publication approval reuses the canonical Week-3 compensated
`PublicationReviewService.resolve`. `audit_events` is immutable at the **grant** level
(`revoke update, delete, truncate … from authenticated`), so an RLS-passing admin still
cannot mutate history (permission-denied, not a silent no-op — the failure mode we hit and
fixed in testing).

## Consequences
Uniform, greppable audit actions (`ADMIN_*`). No admin-authored customer artifacts. History
is append-only by grant, not merely by policy. See ADR-0024, ADR-0025.
