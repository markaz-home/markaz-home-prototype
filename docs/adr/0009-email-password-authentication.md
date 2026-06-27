# ADR 0009: Email + Password Authentication (replaces passwordless OTP)

- **Status:** Accepted
- **Date:** 2026-06

## Revision — design-fidelity pass (supersedes two earlier decisions below)

After the auth/onboarding design spec (`docs/design/auth-onboarding-design-spec.md`)
was approved, two decisions in this ADR were changed:

1. **Password recovery uses the official Supabase recovery LINK, not a code.** The
   6-digit code is now used for **email verification only**. Forgot Password calls
   `resetPasswordForEmail(email, { redirectTo: <app>/auth/confirm })`; the recovery
   email contains a link; the `/auth/confirm` route handler runs
   `verifyOtp({ type: 'recovery', token_hash })` (establishing the recovery session
   in secure cookies) and forwards to `/reset-password`; the page renders only with a
   valid recovery session, then `updateUser({ password })` → **sign out → fresh
   sign-in** (rationale unchanged). The recovery token is handled by the auth library
   and never displayed or logged.
2. **Password max length is 128** (design spec §10.5), not 72. The full policy is
   enforced in the client + zod schema; the pinned local Supabase CLI rejects
   password-policy config keys, so the deployed platform owns the server-side policy.

The auth/onboarding UI was also refactored to the spec: split AuthShell (header with
language switcher + footer + support panel), 3-step progress, a 6-cell verification
code (one logical accessible input), and the full screen inventory (Check Email,
Email Verified, Recovery Email Sent, Password Updated, Signed Out, Session Expired,
provider/error panels), with a deep-blue Operations shell for admin. The sections
below describe the original Week-1.5 code-based recovery and 72-char cap and are kept
for history; where they conflict, this revision governs.

## Context

Week 1 shipped **passwordless email OTP** as the primary sign-in: a customer
entered an email, received a 6-digit code, and the code _was_ the credential.
This is fine for a demo but is not the model a property marketplace ships to
production:

- A returning customer has to wait for an email on **every** sign-in, which is
  slow and couples every login to email deliverability.
- There is no durable secret the customer controls; "account recovery" and
  "sign in" are the same path, so there is nothing to recover.
- Standard expectations (password managers, a real password policy, a real
  "forgot password" flow) cannot be met without a password.

## Decision

Sign-in is **email + password** via Supabase Auth
(`supabase.auth.signInWithPassword`). 6-digit email codes are retained, but
**only** for two purposes:

1. **Verifying a new account** (after sign-up).
2. **Password recovery** (forgot-password).

No SMS. **No custom codes are built, stored, or logged by app code** — codes are
generated and validated entirely by Supabase Auth and delivered by email.

### Sign-up and email verification

`/[locale]/sign-up` collects full name, email, password, confirm password, and
explicit **Terms** + **Privacy** consent, then calls:

```ts
supabase.auth.signUp({
  email,
  password,
  options: { data: { full_name, terms_accepted, privacy_accepted } },
})
```

The user is routed to `/[locale]/verify-email`, where they enter the 6-digit
code from the **`confirmation`** email template and the app calls
`verifyOtp({ type: 'signup' })`. On success the customer continues to the
simulated UAE PASS identity step and then the dashboard.

`enable_confirmations = true` in `supabase/config.toml`; the `confirmation.html`
template carries the 6-digit `{{ .Token }}`. Confirmation is intentionally **not**
disabled, so the verification path is exercised in tests (codes are read from the
local Mailpit inbox).

### Password recovery

`/[locale]/forgot-password` calls `resetPasswordForEmail` and **always** shows a
generic "If an account exists…" message (anti-enumeration — see below).
`/[locale]/reset-password` takes the 6-digit recovery code (from the
**`recovery`** template) plus a new password and runs:

```ts
verifyOtp({ type: 'recovery' })   // establishes a recovery session
updateUser({ password })          // sets the new password
// then: sign out → redirect to /sign-in?reset=1
```

**Why sign out after a successful reset?** `verifyOtp({ type: 'recovery' })`
mints a live session as a side effect. Treating "I reset my password" as an
authenticated dashboard entry is surprising and conflates a recovery session
with a normal login. We deliberately **sign the user out and require a fresh
sign-in** with the new password (`/sign-in?reset=1` renders a "Password updated"
notice). This proves the new password works, gives one clean session state, and
keeps "completed recovery" distinct from "logged in".

### Existing passwordless accounts

Accounts created under the Week 1 passwordless flow have **no password**. They
transition by using **Forgot Password**: the recovery code proves email access,
and `updateUser({ password })` sets a first password. No migration job or
bulk-reset is required; the recovery path is the transition path.

### Duplicate-email safety (anti-enumeration)

Supabase Auth does not error when `signUp` is called for an **already-confirmed**
email. It returns a user object with an **empty `identities[]`** array and no
error. The app's `isLikelyExistingAccount` helper detects this and shows safe
copy plus **Sign In** / **Forgot Password** actions. The app does **not**:

- query the `profiles` table to test existence,
- expose any enumeration endpoint, or
- surface raw database/auth errors.

Profile creation stays **idempotent** via the `handle_new_user` trigger
(`on conflict do nothing`), so a re-attempt cannot duplicate or corrupt a row.

### Admin provisioning

There is **no public admin sign-up**. The admin app (`apps/admin`) offers only
`/login`, `/forgot-password`, and `/reset-password`. After sign-in it requires
`account_type === 'ADMIN'`; otherwise it routes to `/access-denied` (which emits
an `ADMIN_ACCESS_DENIED` audit event). Admin accounts are created **only** by the
provisioning script (`packages/db/src/scripts/setup-demo.ts`, run via
`pnpm db:setup`), which uses the Supabase **Admin API** to create the user and
then promotes `account_type` to `ADMIN` in the database. Public sign-up can never
create an admin: the `handle_new_user` trigger hard-codes `account_type = CUSTOMER`.

## Data ownership: Supabase Auth vs `profiles`

| Lives in **Supabase Auth** | Lives in **`profiles`** (our DB) |
| --- | --- |
| Email + password hash (bcrypt) | `full_name` |
| Email-confirmation state | `account_type` (`CUSTOMER` / `ADMIN`) |
| OTP/recovery codes + tokens | Identity status (e.g. `VERIFIED_DEMO`) |
| Session refresh tokens | `terms_accepted_at` / `privacy_accepted_at` consent timestamps |
| | `onboarding_completed_at` |

**No secrets are stored in `profiles`** — no password hashes, no OTP/recovery
codes, no session tokens. Those are owned entirely by Supabase Auth. `profiles`
holds only product/profile data and consent timestamps. RLS on `profiles` is
unchanged by this ADR.

## Routing gate

`resolvePostAuthDestination({ emailVerified, profile })`
(`packages/domain/src/routing.ts`) now gates on **email verification first**:

```
not email-verified        → verify-email
profile incomplete        → profile-setup (fallback only)
identity NOT_STARTED/PENDING/FAILED → uae-pass (resume)
otherwise                 → dashboard
```

An unverified or incomplete customer **can never reach the dashboard**.
`requireCustomerStep` (`apps/web/src/server/session.ts`) enforces the same order
server-side, so the gate is not merely client UX.

## Security & enumeration considerations

- **No field-level credential errors.** Bad credentials return a single generic
  message: _"The email or password is incorrect."_ — never revealing whether the
  email exists, whether the password was wrong, or whether the account is an
  admin.
- **`email_not_confirmed`** is the one credential-error exception we act on: it
  routes the user to `verify-email` (the email is known to them already; this
  leaks nothing new).
- **Forgot-password is constant-response** ("If an account exists…") regardless
  of whether the email exists.
- **Password policy** (min 8; upper, lower, number, special; max 72 to stay
  within the provider's bcrypt-safe limit) is enforced in the client form (live
  checklist + strength meter) and the zod schema (`packages/domain/src/auth.ts`).
  The pinned local Supabase CLI rejects password-policy config keys, so the
  deployed platform owns the equivalent server-side GoTrue policy. (Every signup
  password that passes our policy already satisfies GoTrue's weaker default.)
- **Audit metadata is generic** — passwords, codes, and tokens are never logged.

## Limitations (honest)

- **Session-expired detection is best-effort.** Expiry is surfaced via a
  `?expired=1` query hint on the sign-in route, not a guaranteed server signal.
- **Demo Auth users get random UUIDs.** Because demo users are now created
  through the Admin API (not SQL), their IDs are non-deterministic; integration
  tests resolve them **by email**, not by a hard-coded UUID.
- **Arabic legal copy is unreviewed.** The Terms/Privacy consent strings exist in
  `ar.json` but the legal wording is **not** yet business-reviewed and must not be
  represented as approved.

## Consequences

- Returning sign-in no longer depends on email deliverability.
- A real recovery flow exists and doubles as the transition path for legacy
  passwordless accounts.
- Two email templates (`confirmation`, `recovery`) must stay wired to emit the
  6-digit `{{ .Token }}`.
- Demo provisioning moved out of SQL seed into the Admin-API script
  (`pnpm db:setup`) — see ADR-context in the demo runbook.
- Supersedes the passwordless-OTP description in Week 1 docs (ADR-0007's
  one-click demo fallback remains disabled and unaffected).
