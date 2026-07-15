# ADR-0017: Offer expiry processing

**Status:** Accepted (Week 4)

## Context

Each current proposal has a server-authoritative expiry (48h / 3d / 7d / none, default 7d —
offers-design-spec §25). Expired proposals cannot be accepted or countered. The prototype
has no durable job system, and correctness must not depend on one.

## Decision

Expiry is **server-authoritative and processed lazily**:

- Expiry instants are computed server-side (`expiryFromOption`) and stored UTC on the
  proposal + mirrored on the thread.
- Every mutation re-checks the current proposal's `expires_at` and rejects action on an
  expired proposal (`EXPIRED`).
- `expire_due_offers()` (`SECURITY DEFINER`) transitions `AWAITING_*` threads whose current
  proposal has expired to `EXPIRED` (+ events/notifications). It is called at the start of
  the offer read queries (`getThread`, `getBuyerThreads`, `getSellerInbox`,
  `getUnreadCounts`), so state converges on read without a background job.

## Consequences

- No constantly-animated countdown; correctness is independent of any timer (§25.2).
- A future background job can call `expire_due_offers()` for proactive expiry without
  changing correctness.
