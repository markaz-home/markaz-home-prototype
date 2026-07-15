# ADR-0014: Offer thread + immutable proposal model (supersedes the Week-1 flat offers stub)

**Status:** Accepted (Week 4)

## Context

Week 1 laid down placeholder `public.offers` + `counter_offers` tables (a flat,
single-offer model with enum `offer_state`). The approved Week-4 design
(`docs/design/offers-design-spec.md` §4) requires a **negotiation thread** per
`(buyer, listing)` holding an **immutable chronological sequence of proposals** with an
explicit next-actor and preserved history — counters must not overwrite prior amounts.
The flat model cannot represent this. Nothing but the seed and one admin metric used the
old tables.

## Decision

Replace the Week-1 offer scaffolding. Migration `20260301000804_offers.sql` drops
`offers`/`counter_offers`, the `offer_state` enum, and their trigger/policy, and drops the
`transactions.offer_id` FK (column retained, nullable, for Week 5). It introduces
`offer_threads`, `offer_proposals` (immutable), and `offer_events`, and **reuses** the
existing generic `notifications` and `audit_events` tables rather than creating parallel
systems. The Drizzle mirror and `packages/domain/src/offer.ts` are rewritten to match; the
admin metric counts active threads.

## Consequences

- One canonical offer model; no dead/conflicting schema or domain code.
- All offer writes go through SECURITY DEFINER functions (see ADR-0015); customers have
  read-only RLS on the offer tables.
- Week 5 repoints `transactions.offer_id` at the accepted offer thread.
