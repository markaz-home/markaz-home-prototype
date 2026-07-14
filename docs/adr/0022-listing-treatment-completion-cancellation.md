# ADR-0022 — Listing treatment on completion & cancellation (Week 5)

## Status
Accepted (Week 5).

## Context
A completed or cancelled transaction must update the listing without claiming a real sale and
without silently returning a listing to the marketplace.

## Decision
- **Completion** → listing `state = 'SOLD_DEMO'` (value already in the enum). The marketplace
  security-barrier view filters `state = 'LIVE'`, so `SOLD_DEMO` is automatically excluded;
  publication history is preserved; new offers are blocked. Not reversible in Week 5.
- **Cancellation** → listing `state = 'PAUSED'` (only when currently LIVE); **never auto-LIVE**.
  The seller must explicitly review/resume. The cancelled transaction is excluded from
  `listing_has_accepted_offer`, so a resumed listing no longer derives `UNDER_OFFER`.

Both writes happen only inside the transaction `SECURITY DEFINER` functions — the Week-3
publication state machine is untouched.

## Consequences
No "SOLD"/"transferred" claims; no accidental re-listing. Verified live for both paths. See
ADR-0016 (derived UNDER_OFFER) and ADR-0010 (listing state machine).
