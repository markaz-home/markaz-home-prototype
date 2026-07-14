# ADR-0016: Derived UNDER_OFFER availability

**Status:** Accepted (Week 4)

## Context

When a seller accepts an offer the listing should stop accepting new offers and present an
"Under offer" treatment, while remaining publicly visible, saveable, and shareable
(offers-design-spec §6, §1.1.9). We must not corrupt the Week-3 publication state machine.

## Decision

Do **not** add `UNDER_OFFER` to the `listing_state` enum. Keep `LIVE | PAUSED`. Derive a
separate **offer availability** (`AVAILABLE | UNDER_OFFER | OFFERS_DISABLED`) from the
listing state plus the presence of an accepted offer:

- `LIVE` + no accepted offer → `AVAILABLE`
- `LIVE` + accepted offer → `UNDER_OFFER`
- non-`LIVE` → `OFFERS_DISABLED`

Implemented as the pure `resolveAvailability` (`packages/domain`) and computed server-side
in eligibility + the listing-offers view. New offers are blocked while `UNDER_OFFER`
(`create_offer` raises `UNDER_OFFER`; the partial unique index makes the accepted-offer
check cheap).

## Consequences

- The Week-3 publication state machine is untouched; the marketplace view still surfaces
  the listing as `LIVE`.
- Availability is always derivable, never a stored field that can drift.
