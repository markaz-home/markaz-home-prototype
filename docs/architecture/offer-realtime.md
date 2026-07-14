# Offer realtime (Week 4)

Realtime is an **enhancement**, never the correctness boundary (offers-design-spec §29,
ADR-0018). Built on the Week-1 Realtime foundation (ADR-0005: Realtime connects directly
to the database, never behind a pooler).

## Channel

`offer_threads` and `offer_events` are added to the `supabase_realtime` publication
(migration `…0804`). The client hook `useOfferThreadChannel(threadId, onChange)`
(`packages/realtime/src/use-offer-thread-channel.ts`) subscribes to `postgres_changes`
INSERTs on `offer_events` filtered by `thread_id=eq.<id>`.

## Correctness pattern

1. Receive event → call `onChange`.
2. `onChange` **refetches** authoritative thread state via tRPC (`getThread`) and
   invalidates `getUnreadCounts`. The realtime **payload is never applied directly**.
3. React state is replaced; meaningful changes are announced politely (aria-live).
4. Reconnect re-fires `onChange` so the client reconciles after a dropped connection.

Duplicate events are safe (idempotent refetch). Stale UI actions are rejected server-side
by the `version` check regardless of realtime.

## Channel security

RLS on `offer_threads`/`offer_events` scopes `postgres_changes` delivery to participants —
a subscriber only receives rows it can `SELECT`. **Anonymous subscribers receive nothing**
(no grant/policy). No private offer payload is broadcast on a shared public channel. The
production channel policy remains participant-only private channels (spec §42).

## Connection states (§29.3)

`connecting` / `connected` (no banner) → `reconnecting` → `stale` (after ~8s) with a
manual **Refresh**. Announcements are restrained: one per meaningful transition, never per
heartbeat or reconnect attempt.
