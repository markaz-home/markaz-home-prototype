# ADR 0010: Listing state machine — retry & invalidation semantics

- **Status:** Accepted
- **Date:** 2026-06 (Week 2)

## Context

Week 1 shipped a strict forward-only listing state machine
(`packages/domain/src/listing.ts`): `DRAFT → DETAILS_COMPLETE → … →
READY_TO_PUBLISH → LIVE`, with `canTransitionListing` allowing only single-step
forward moves (plus an admin `→ REJECTED`).

The Week 2 property-listing journey (design spec §1.2, §4) needs a **retryable,
recoverable** prototype:

- A **failed** simulated ownership check or Trakheesi permit must keep the
  listing **recoverable** — the customer replaces the document / reviews and
  retries. It must **not** move the listing to the later-stage `REJECTED` state
  (`REJECTED` is reserved for a future Admin decision, out of scope).
- An **invalidating edit** (replacing a verified document, or editing details /
  settings after Simulated Form A) must rewind the listing to the correct
  milestone instead of silently leaving a stale "complete" state.

The strict forward machine cannot express these moves, and we explicitly do
**not** want hidden/implicit transitions.

## Decision

Keep the forward machine, and add two **explicit, server-only** mechanisms:

1. **Failures do not transition the listing.** A failed simulation updates the
   _record_ (`verifications` / `permit_records`) `status = FAILED_DEMO` and the
   listing stays on its current state. Retry re-runs the simulation. The customer
   never reaches `REJECTED` through the wizard.

2. **Rewind along the linear chain.** `canRewindListing(from, to)`
   (`packages/domain/src/listing.ts`) permits an explicit backward move when both
   states are on the linear setup chain (`LISTING_LINEAR_ORDER`,
   `DRAFT…READY_TO_PUBLISH`) and `to` is strictly earlier than `from`. Rewinds are
   applied only by authorised tRPC procedures (`invalidateDownstream` in the
   listing router), which also mark the now-stale records `superseded_at` so they
   no longer count toward readiness:
   - Replace / remove ownership document → rewind to `DOCUMENT_UPLOADED` /
     `DETAILS_COMPLETE`, supersede the verification.
   - Edit details / settings after Form A → rewind to `OWNERSHIP_VERIFIED`,
     supersede Form A + permit.

3. **Readiness is server-authoritative and derived.** `computeReadiness`
   (`packages/domain/src/listing-progress.ts`) decides `READY_TO_PUBLISH` from a
   normalised snapshot (required sections + record freshness), not from the enum
   alone. The listing reaches `READY_TO_PUBLISH` only when every required section
   is complete **and** the customer confirms on Review (after permit approval).

## Consequences

- The state enum is unchanged; the wizard's Listing Settings / Investment Case /
  Review are **derived sub-states**, not enum values.
- Backward moves are explicit, named, and unit-tested (`listing-journey.test.ts`)
  — no hidden transitions.
- `superseded_at` columns on `verifications` / `form_a_records` / `permit_records`
  record freshness; the active (non-superseded) record is the authoritative one.
- Integration tests prove failure→retry, idempotent resolution, document-replace
  rewind, and the server-side readiness gate.
