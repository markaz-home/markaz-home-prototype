# ADR-0018: Offer realtime channel security

**Status:** Accepted (Week 4)

## Context

Offer updates should feel immediate, but offer data is private to the two participants and
must never leak through a broadly-subscribed public channel (offers-design-spec §29, §37,
§42). Realtime must not become a correctness path.

## Decision

- Add `offer_threads` and `offer_events` to the `supabase_realtime` publication. Because
  RLS is enabled on those tables with participant-only `SELECT` policies, Supabase Realtime
  delivers `postgres_changes` only to subscribers who can read the row — **anonymous
  subscribers receive nothing**, and one buyer never receives another's events.
- The client hook (`useOfferThreadChannel`) treats events as a **signal to refetch
  authoritative state** via tRPC; the realtime payload is never applied directly. Reconnect
  re-fetches; duplicate events are idempotent.
- Realtime connects directly to the database (ADR-0005), never behind a pooler.

## Consequences

- No private offer payload is exposed on a shared channel.
- Server state is always authoritative; stale UI actions are rejected by the `version`
  check regardless of realtime. Production keeps participant-only private channels.
