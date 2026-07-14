# ADR-0029 — Admin realtime as a refetch signal (Week 6)

## Status

Accepted (Week 6).

## Context

Review queues benefit from freshness, but realtime payloads must never become an
authoritative or a data-leak surface.

## Decision

`listing_publication_requests` was added to the realtime publication (migration `…0812`);
`transactions` is already published. The `useAdminQueueChannel` hook subscribes to both and, on any
change, calls back so the dashboard **refetches authoritative metrics** (a server-component refresh).
Following the Week-4/5 rule, a realtime event is only a **refetch trigger**; authoritative state
always comes from a fresh RLS-scoped query. No entity payload is trusted from the channel, and RLS
scopes delivery to admins. A reconnecting/stale indicator (`QueueLive`) is shown only when the
connection is unhealthy (hidden while healthy, per §37). Events are coalesced so a burst triggers a
single refetch.

## Consequences

Live operational queues **without** a second trust boundary — the payload is never read, only used
as a signal. Consistent with `offer-realtime` / `transactions` realtime. See
`docs/architecture/realtime.md`.
