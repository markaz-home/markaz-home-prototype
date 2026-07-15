# ADR-0015: Single-accepted-offer enforcement

**Status:** Accepted (Week 4)

## Context

A seller must accept at most one offer per listing, and two concurrent accepts (e.g. two
browser tabs, or a race between competing offers) must resolve to exactly one winner with
no partially-accepted state (offers-design-spec §6.2, Step 8).

## Decision

Defence in depth, both at the database:

1. **Partial unique index** `uniq_accepted_thread_per_listing` on `offer_threads
(listing_id) WHERE status = 'ACCEPTED'` — the database refuses a second accepted thread.
2. **Controlled acceptance function** `accept_offer(thread, proposal, expected_version)`
   (`SECURITY DEFINER`): locks the listing row (`SELECT … FOR UPDATE`), re-reads, validates
   ownership + LIVE + availability + current/unexpired proposal + version, confirms no
   accepted thread exists, marks the thread/proposal `ACCEPTED`, closes all other active
   threads as `CLOSED_OTHER_ACCEPTED`, and writes events + notifications — atomically.

Two concurrent accepts serialise on the listing lock; the second re-reads, sees the
accepted thread, and fails safely (`ALREADY_ACCEPTED`). The unique index is the backstop.

## Consequences

- Acceptance is atomic and race-free (verified: `tests/integration/offers.test.ts`).
- Ordinary customers cannot set `ACCEPTED` directly (guard trigger + read-only RLS).
