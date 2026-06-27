# Authentication & Row-Level Security

## Authentication flow

Authentication is **real Supabase email OTP** (6-digit). Codes are captured by
**Inbucket** locally (http://127.0.0.1:54324) and delivered via **SES** in
deployed demos. OTP codes are **never built, stored, or logged by app code**.
Sessions are `@supabase/ssr` **secure cookies** — tokens are never hand-stored.

### New customer

landing → email → **OTP** → profile setup → **simulated UAE PASS** → dashboard.

The UAE PASS step is simulated and sets identity status to `VERIFIED_DEMO`.

### Returning verified customer

A returning customer whose **profile is complete** and whose identity status is
`VERIFIED_DEMO` **skips onboarding** and goes straight to the dashboard.

### Admin

The admin app uses the **same OTP provider**. After authentication it **loads the
profile and requires `account_type === 'ADMIN'`**; otherwise it shows an
**access-denied** screen (ADR 0008).

### Routing decision

The post-auth destination is decided by **`resolvePostAuthDestination`** in
`@markaz/domain` (single source of truth for new-vs-returning-vs-admin routing).

## Session handling

`@supabase/ssr` manages secure cookies on the server and client. The app never
stores raw access/refresh tokens itself. Server components and tRPC read the
session from cookies to establish `ctx.user`.

## RLS identity strategy (ADR 0004)

Direct Drizzle/postgres-js queries do **not** inherit the Supabase user. Identity
is propagated **explicitly per transaction**:

`withUserContext(db, {userId, email, accountType}, fn)` in
`packages/db/src/rls-context.ts`:

1. Opens a transaction.
2. `select set_config('request.jwt.claims', '{...sub...}', true)` — so
   `auth.uid()` resolves to the real user (transaction-local).
3. `select set_config('role', 'authenticated', true)` (transaction-local).
4. Runs `fn` with `ctx.tx`.
5. Commits — context vanishes.

Companion contexts:

- `withAnonContext` — role `anon`, public `LIVE` data only.
- `withServiceContext` — trusted server ops only (migrations/seed/worker/admin);
  **never** for customer-scoped requests.

`authContext.whoami` returns the DB-resolved `auth.uid()` + current role to
**prove** the context propagates.

## tRPC procedure tiers

| Procedure | Requires | Context helper |
| --- | --- | --- |
| `protectedProcedure` | any authenticated account | `withUserContext` |
| `customerProcedure` | `account_type === 'CUSTOMER'` | `withUserContext` |
| `adminProcedure` | `account_type === 'ADMIN'` | `withUserContext` |

Every resolver in these tiers runs inside the RLS-scoped transaction and must use
`ctx.tx`.

## Policy matrix (per table, summarized)

| Table | Public (anon) | Owner customer | Other customer | Admin |
| --- | --- | --- | --- | --- |
| `profiles` | — | read/write own; cannot change `account_type` | — | read (via `is_admin()`) |
| `listings` | read **LIVE** only | read/write own | read LIVE only | full |
| `property_photos` | read photos of **LIVE** listings | read/write own | LIVE only | full |
| `properties` | — | read/write own | — | full |
| `ownership_documents` | — | read/write own (private) | denied | read |
| `offers` | — | offering customer reads own; listing owner reads offers on their listing | denied | full |
| `counter_offers` | — | parties to the offer | denied | full |
| `transactions` | — | buyer **or** seller | denied | full |
| `transaction_stage_history` | — | parties to the transaction | denied | full |
| `audit_events` | — | insert-only | insert-only | read |

Key enforced rules baked into the schema/policies:

- **Insert offer** only if `created_by = auth.uid()` **AND** the listing is **not
  your own** (insert policy + `enforce_offer_not_on_own_listing()` trigger).
- **No self-promotion:** `prevent_account_type_escalation()` blocks a customer
  changing their own `account_type`.
- `is_admin()` is a SECURITY DEFINER function used by admin policies.
- RLS is **enabled and forced** on all tables.

## Storage boundaries

- `ownership-documents` — **private**; access via **signed URLs** only; owner +
  admin read, owner writes.
- `listing-photos` — **public**; anyone reads, owner writes.

`storage.objects` RLS enforces these. Only safe **fictional** sample files are
used — never real Title Deeds, Emirates IDs, or passports.

## Tested guarantees (integration-test gate)

The following are asserted by integration tests against the local Supabase stack
(the gate from ADR 0004):

- A customer can read/write **their own** records.
- A customer is **denied** access to another customer's records.
- An **anonymous** caller sees **only public `LIVE`** data.
- **Admin** scope works via `is_admin()`.
- A customer **cannot self-promote** to admin.
- A customer **cannot make an offer on their own listing**.
- A **private** ownership document is **not reachable** via public access.
- The **service-role key is never used** to serve a customer request.
