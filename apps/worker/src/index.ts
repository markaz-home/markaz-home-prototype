/**
 * MARKAZ worker service — DOCUMENTED PLACEHOLDER (Week 1).
 *
 * Not built this milestone. In a later milestone this becomes a Graphile Worker
 * service (Postgres-backed durable jobs + timers) handling, e.g.:
 *   - the real 48-hour counter-offer expiry timer
 *   - simulated async verification / permit issuance flows
 *
 * Connection policy (§6A.2): the worker connects DIRECTLY to the database
 * endpoint, or through a separately-validated pooled connection — never via a
 * pooler placed in front of Realtime. It uses trusted server credentials, never
 * a customer-scoped session.
 */
export const WORKER_PLACEHOLDER = true;
