# Realtime

## What it proves (Week 1)

A minimal end-to-end proof that Supabase Realtime works through our stack:

1. Two browser sessions subscribe to the `realtime_counters` table (via the
   `@markaz/realtime` hook).
2. A permitted tRPC mutation, **`realtime.increment`**, updates the counter row.
3. The **other** session reflects the new value **without a page refresh**.
4. On **reconnection**, the client **re-fetches the authoritative value**.

The `realtime_counters` table has RLS enabled and is added to the
`supabase_realtime` publication (migration `20260301000500_realtime_proof.sql`).

## Production rule: Realtime connects directly to the database (ADR 0005)

Supabase Realtime uses Postgres **logical replication**. In production:

- **Realtime → direct RDS endpoint.** **RDS Proxy must NEVER sit in front of
  Realtime** — the pooler does not support the replication protocol or
  replication slots.
- App / API query paths → **RDS Proxy** (pooled).
- Migrations and admin ops → **direct**.

This is a platform/networking responsibility; it is captured in
`infra/supabase/rds-compatibility-checklist.md` and `infra/environment-contract.md`.

## Future use

The same Realtime channel is the intended foundation for an **offer-expiry timer /
countdown** in the marketplace (deferred): an offer's remaining time and state
transitions can be pushed to subscribed sessions instead of polled. Not
implemented in Week 1.
