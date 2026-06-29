# Authentication & Row-Level Security

## Authentication flow

Authentication is **email + password** via Supabase Auth (ADR 0009). A 6-digit
email code is retained **only** for **new-account email verification**; password
recovery uses the **official Supabase recovery LINK** (not a code). Neither is the
sign-in credential, and SMS is never used. Codes, links, and tokens are generated
and validated by Supabase Auth and are **never built, stored, or logged by app
code**. Sessions are `@supabase/ssr` **secure cookies** — tokens are never
hand-stored. Locally, mail lands in **Mailpit** (http://127.0.0.1:54324; Inbucket
on older CLIs); SES delivers in deployed demos.

### New customer (sign-up + verification)

`/[locale]/sign-up` (full name, email, password, confirm, Terms, Privacy) →
`signUp({ email, password, options:{ data:{ full_name, terms_accepted,
privacy_accepted } } })` → `/[locale]/verify-email` (6-digit `confirmation` code)
→ `verifyOtp({ type:'signup' })` → **simulated UAE PASS** → dashboard.

The UAE PASS step is simulated and sets identity status to `VERIFIED_DEMO`. The
normal path hydrates `full_name` + consent from Auth metadata via
`handle_new_user`, so **profile-setup is a fallback only**.

### Returning customer (sign-in)

`/[locale]/sign-in` (email + password) → `signInWithPassword`. Bad credentials
return a **single generic** message — "The email or password is incorrect." —
that never reveals which field was wrong, whether the account exists, or whether
it is an admin. `email_not_confirmed` is the one case acted on: it routes to
`verify-email`. A returning verified customer (`VERIFIED_DEMO` + complete profile)
skips onboarding and goes straight to the dashboard.

### Password recovery

`/[locale]/forgot-password` → `resetPasswordForEmail(email, { redirectTo:
<app>/auth/confirm })` → **always** the generic "If an account exists…" message
(anti-enumeration). The recovery email contains a **link**; the top-level
`/auth/confirm` route handler runs `verifyOtp({ type:'recovery', token_hash })`
(establishing the recovery session in secure cookies) and forwards to
`/[locale]/reset-password`. That page renders **only** with a valid recovery
session (otherwise it shows an invalid-link panel); it asks for a **new password
only — no code field** → `updateUser({ password })` → **sign out → fresh
sign-in** at `/reset-password/success` → `/sign-in`. Legacy passwordless accounts
set their first password this way. Sign-out-after-reset is deliberate (ADR 0009).

### Duplicate-email safety

`signUp` for an already-confirmed email returns a user with **empty
`identities[]`** and no error; `isLikelyExistingAccount` shows safe copy + Sign In
/ Forgot Password. No profiles-existence query, no enumeration endpoint, no raw DB
errors. Profile creation is idempotent (`handle_new_user`, `on conflict do
nothing`).

### Password policy

Min 8; requires upper, lower, number, special; **max 128** (design spec §10.5).
Passwords longer than 128 produce a clear validation error — never a silent
truncation. Enforced at two layers today: the **client form** (live checklist +
strength meter) and the **shared zod schema** (`packages/domain/src/auth.ts`) used
by every auth form. The pinned local Supabase CLI rejects password-policy config
keys, so `supabase/config.toml` does **not** enforce the full policy; production
**server-side GoTrue** policy configuration and validation is a **platform-team**
follow-up (see `infra/supabase/rds-compatibility-checklist.md`).

### Admin

The admin app uses **email + password** with **no public sign-up**
(`/login`, `/forgot-password`, `/reset-password`). After sign-in it **requires
`account_type === 'ADMIN'`**; otherwise it shows an **access-denied** screen
(ADR 0008) and emits an `ADMIN_ACCESS_DENIED` audit event. Admins are created
only by the provisioning script (`pnpm db:setup`, Supabase Admin API).

### Routing decision

The post-auth destination is decided by **`resolvePostAuthDestination({
emailVerified, profile })`** in `@markaz/domain` (single source of truth). It
gates on **email verification first**: `verify-email → profile-setup (fallback) →
uae-pass (resumes NOT_STARTED/PENDING/FAILED) → dashboard`. Unverified or
incomplete customers can **never** reach the dashboard. `requireCustomerStep`
(`apps/web/src/server/session.ts`) enforces the same order server-side.

### Data ownership (Auth vs profiles)

Supabase **Auth** owns credentials, the password hash, email-confirmation
state, and all verification/recovery codes, links, and tokens. **`profiles`** owns `full_name`,
`account_type`, identity status, consent timestamps, and `onboarding_completed_at`
— **no secrets**. RLS on `profiles` is unchanged.

### Audit events

Server-side: `ACCOUNT_PROFILE_COMPLETED`, `DEMO_IDENTITY_STARTED/VERIFIED/FAILED`.
Client-emitted via the allow-listed `audit.record` tRPC procedure: `EMAIL_VERIFIED`,
`CUSTOMER_SIGNED_OUT`, `ADMIN_ACCESS_DENIED`. Generic metadata only — never
passwords, codes, or tokens.

## Session handling

`@supabase/ssr` manages secure cookies on the server and client. The app never
stores raw access/refresh tokens itself. Server components and tRPC read the
session from cookies to establish `ctx.user`. Session-expiry is surfaced
best-effort via a `?expired=1` hint on the sign-in route.

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
