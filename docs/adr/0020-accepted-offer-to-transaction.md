# ADR-0020 — Accepted-offer → transaction relationship (Week 5)

## Status

Accepted (Week 5).

## Context

Week 4 acceptance stops at `ACCEPTED` and creates no transaction. Week 5 must bridge to a
transaction without duplicates, stale proposals, or unrelated actors.

## Decision

`ensure_transaction(thread)` is **idempotent, automatic, and server-authoritative**. It is
invoked from the accepted-offer handoff ("Continue to transaction"). It validates the thread is
`ACCEPTED`, derives buyer/seller/listing and `accepted_amount_aed` from the accepted proposal,
and atomically inserts the transaction + 17 milestone tasks + `TRANSACTION_CREATED` event +
both participant notifications + audit. Duplicate calls (either participant) return the existing
row; `uniq_transaction_per_thread`/`uniq_transaction_per_proposal` are the DB backstop. A
non-participant is rejected `NOT_FOUND`; a non-accepted thread `NOT_ACCEPTED`.

## Consequences

Deterministic, race-safe creation; the accepted thread/proposal remain the immutable source of
identity and amount. Verified by integration tests. See ADR-0019.
