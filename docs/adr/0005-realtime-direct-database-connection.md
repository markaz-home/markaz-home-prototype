# ADR 0005: Supabase Realtime Connects Directly to the Database

- **Status:** Accepted
- **Date:** 2026-03

## Context

Supabase Realtime streams database changes via Postgres **logical replication**.
In the intended production topology on AWS, the application/API query paths sit
behind **RDS Proxy** (connection pooling). RDS Proxy is a transaction/connection
pooler and does **not** support the replication protocol or the long-lived
replication slots that logical replication requires. Putting Realtime behind RDS
Proxy breaks replication.

## Decision

**Supabase Realtime connects DIRECTLY to the RDS database endpoint** (logical
replication). **RDS Proxy must NEVER sit in front of Realtime.**

Topology:

- App / API query paths → **RDS Proxy** (pooled).
- Realtime (logical replication) → **direct RDS endpoint**.
- Migrations → **direct** (DDL, replication-slot management).
- Admin maintenance ops → **direct**.

This boundary is a platform/networking responsibility (see `infra/`) and is
called out in the RDS compatibility checklist and environment contract.

## Proof (Week 1)

Two browser sessions subscribe to the `realtime_counters` table. A permitted
tRPC mutation (`realtime.increment`) updates the row; the **other** session
reflects the new value **without a refresh**. On reconnection, the client
re-fetches the authoritative value. This demonstrates the subscribe → mutate →
propagate → reconnect path end-to-end.

## Consequences

- Network/topology design must expose a direct database endpoint for Realtime
  separate from the pooled app path; security groups must permit it.
- A future offer-expiry timer / countdown feature can build on the same Realtime
  channel (see `docs/architecture/realtime.md`).
- Misconfiguring Realtime to use the pooler is a silent failure mode; the
  checklist and environment contract exist to prevent it.
