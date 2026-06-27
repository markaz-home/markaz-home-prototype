# ADR 0004: tRPC + Drizzle RLS Identity Propagation (§6A.3, Option 1)

- **Status:** Accepted
- **Date:** 2026-03

## Context

Supabase's PostgREST Data API automatically runs queries as the authenticated
user, so Postgres `auth.uid()` resolves and RLS policies apply. But we query the
database **directly with Drizzle + postgres-js** over a normal Postgres
connection. A direct connection does **not** inherit the Supabase user: by
default `auth.uid()` is null and RLS either denies everything or (worse, if we
reached for the service-role key) is bypassed entirely.

We need direct Drizzle queries to be evaluated by the **same** RLS policies as the
Data API, without ever using the service-role key for customer-scoped requests.

### Options considered

1. **Per-transaction identity propagation via `set_config` (chosen).** Open a
   transaction, set the JWT claims and role as transaction-local settings, run
   the query, commit. RLS evaluates against the real user. Context vanishes at
   commit.
2. **Route customer queries through the Supabase Data API (PostgREST).** Keeps
   RLS automatic, but gives up Drizzle's typed query builder for customer paths,
   splits the data layer in two, and couples us to PostgREST semantics.
3. **Use the service-role key and enforce access in application code (rejected).**
   Bypasses RLS, moving the entire security boundary into hand-written app
   checks. One missed check is a data breach. Not acceptable for customer data.

## Decision

Adopt **Option 1**. The helper `withUserContext(db, {userId, email, accountType}, fn)`
in `packages/db/src/rls-context.ts`:

1. Opens a transaction.
2. Runs `select set_config('request.jwt.claims', '{...sub...}', true)` so
   `auth.uid()` resolves to the real user (`sub` claim), transaction-local.
3. Runs `select set_config('role', 'authenticated', true)`, transaction-local.
4. Executes `fn` with the transaction handle (`ctx.tx`).
5. Commits — at which point the transaction-local context vanishes.

The tRPC procedure tiers wrap every resolver in this RLS-scoped transaction and
pass `ctx.tx`:

- `protectedProcedure` — any authenticated account.
- `customerProcedure` — `account_type === 'CUSTOMER'`.
- `adminProcedure` — `account_type === 'ADMIN'`.

Companion helpers for non-customer paths:

- `withAnonContext` — role `anon`; only public `LIVE` data, used for unauthenticated reads.
- `withServiceContext` — role with elevated privileges for **trusted server ops
  only** (migrations, seed, worker, admin maintenance). **Never** used to serve a
  customer-scoped request.

**Proof obligation:** `authContext.whoami` returns the DB-resolved `auth.uid()`
and current role so we can demonstrate the context actually propagates rather
than assuming it.

## Consequences

- Direct Drizzle queries are governed by the **same** RLS policies as the Data
  API; the database is the security boundary, not app code.
- The service-role key is never used for customer requests, eliminating the
  "one missed check = breach" failure mode of Option 3.
- Every customer/admin resolver runs inside a transaction; resolvers must use
  `ctx.tx`, not a fresh connection, or they lose the identity context.
- **Integration-test gate:** the RLS guarantees (own-record access, cross-customer
  denial, anon sees only public `LIVE`, admin scope, no self-promotion, no offer
  on own listing, private docs not publicly reachable, service-role not used for
  customer paths) are asserted by integration tests against the local Supabase
  stack. These tests are the gate that keeps the policies honest.
- Slight overhead: one transaction per request and two `set_config` round-trips;
  acceptable for the correctness guarantee.
