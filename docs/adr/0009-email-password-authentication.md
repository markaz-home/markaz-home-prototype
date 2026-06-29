# ADR 0009: Email + Password Authentication (replaces passwordless OTP)

- **Status:** Accepted
- **Date:** 2026-06 (revised after the auth/onboarding design-spec pass)

## Summary (authoritative)

Sign-in is **email + password** via Supabase Auth. Email artefacts are split by
purpose, and this split is the single source of truth — there is no code-based
recovery anywhere in the system:

```
Six-digit email code      → new-account email verification only
Official Supabase link    → Forgot Password and Reset Password
```

- **New-account verification** uses a 6-digit code (`verifyOtp({ type:'signup' })`).
- **Password recovery** uses the **official Supabase recovery LINK**
  (`resetPasswordForEmail` → email link → `/auth/confirm` runs
  `verifyOtp({ type:'recovery', token_hash })` → `/reset-password` → `updateUser` →
  sign out → fresh sign-in). **No 6-digit recovery code exists or is requested.**
- **Password range is 8–128 characters** (min 8; upper, lower, number, special;
  max 128 — design spec §10.5).
- **Policy enforcement layers:** the client form and the shared zod schema enforce
  the full application policy today; production **server-side GoTrue** policy
  configuration and validation is a **platform-team** follow-up (the pinned local
  Supabase CLI rejects password-policy config keys, so `supabase/config.toml` does
  **not** enforce the full policy locally).
- **No custom codes, passwords, hashes, or tokens are built, stored, or logged by
  app code** — Supabase Auth owns them all.

The auth/onboarding UI follows the approved design spec: split AuthShell (header
with language switcher + footer + support panel), 3-step progress, a 6-cell
verification code (one logical accessible input), the full screen inventory (Check
Email, Email Verified, Recovery Email Sent, Password Updated, Signed Out, Session
Expired, provider/error panels), and a deep-blue Operations shell for admin.

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
(`supabase.auth.signInWithPassword`). A 6-digit email code is retained, but
**only** to **verify a new account** after sign-up. No SMS. **No custom codes are
built, stored, or logged by app code** — codes, links, and tokens are generated
and validated entirely by Supabase Auth and delivered by email.

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

### Password recovery (official recovery LINK — not a code)

`/[locale]/forgot-password` calls

```ts
supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/auth/confirm` })
```

and **always** shows a generic "If an account exists…" message (anti-enumeration —
see below). The recovery email (`recovery.html`) contains a **link** to
`{{ .RedirectTo }}/auth/confirm?token_hash=…&type=recovery&next=/reset-password`.

A **top-level** route handler at `/auth/confirm` (outside `[locale]`, present in
both apps) verifies the token and establishes the recovery session in secure
cookies, then forwards to `/reset-password`:

```ts
// app/auth/confirm/route.ts (GET)
const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
if (!error) return NextResponse.redirect(new URL(next, origin))     // → /reset-password
return NextResponse.redirect(new URL('/reset-password?error=invalid', origin))
```

`/[locale]/reset-password` renders **only** with a valid recovery session (the
page checks `getAuthUser()` and the `?error=invalid` hint; otherwise it shows an
invalid-link panel with a "Request a new link" action). The form asks for a **new
password only — there is no code field** — and runs:

```ts
updateUser({ password })          // sets the new password
// then: sign out → /reset-password/success → fresh sign-in
```

**Why sign out after a successful reset?** `verifyOtp({ type: 'recovery' })` mints
a live session as a side effect. Treating "I reset my password" as an
authenticated dashboard entry is surprising and conflates a recovery session with
a normal login. We deliberately **sign the user out and require a fresh sign-in**
with the new password. This proves the new password works, gives one clean session
state, and keeps "completed recovery" distinct from "logged in".

Invalid, missing, reused, or expired links — and direct access to
`/reset-password` without a recovery session — all land on the invalid-link panel;
no password is changed.

### Existing passwordless accounts

Accounts created under the Week 1 passwordless flow have **no password**. They
transition by using **Forgot Password**: the recovery **link** proves email
access, and `updateUser({ password })` sets a first password. No migration job or
bulk-reset is required; the recovery link path is the transition path.

### Duplicate-email safety (anti-enumeration)

Supabase Auth handles a duplicate sign-up in two ways depending on
version/config; the app handles **both**:

1. **Obfuscated** — `signUp` for an already-confirmed email returns a user with an
   **empty `identities[]`** array and no error (`isLikelyExistingAccount`).
2. **Explicit** — GoTrue returns a `422 user_already_exists` / `email_exists`
   error (`isExistingAccountError`).

Either path shows safe copy plus **Sign In** / **Forgot Password** actions. The
app does **not** query the `profiles` table to test existence, expose any
enumeration endpoint, or surface raw database/auth errors. Profile creation stays
**idempotent** via the `handle_new_user` trigger (`on conflict do nothing`), so a
re-attempt cannot duplicate or corrupt a row.

### Admin provisioning

There is **no public admin sign-up**. The admin app (`apps/admin`) offers only
`/login`, `/forgot-password`, and `/reset-password` (recovery uses the same
official-link flow, returning to the **admin** app's `/auth/confirm`). After
sign-in it requires `account_type === 'ADMIN'`; otherwise it routes to
`/access-denied` (which emits an `ADMIN_ACCESS_DENIED` audit event). Admin
accounts are created **only** by the provisioning script
(`packages/db/src/scripts/setup-demo.ts`, run via `pnpm db:setup`), which uses the
Supabase **Admin API** to create the user and then promotes `account_type` to
`ADMIN` in the database. Public sign-up can never create an admin: the
`handle_new_user` trigger hard-codes `account_type = CUSTOMER`.

## Data ownership: Supabase Auth vs `profiles`

| Lives in **Supabase Auth** | Lives in **`profiles`** (our DB) |
| --- | --- |
| Email + password hash | `full_name` |
| Email-confirmation state | `account_type` (`CUSTOMER` / `ADMIN`) |
| Verification codes, recovery links + tokens | Identity status (e.g. `VERIFIED_DEMO`) |
| Session refresh tokens | `terms_accepted_at` / `privacy_accepted_at` consent timestamps |
| | `onboarding_completed_at` |

**No secrets are stored in `profiles`** — no password hashes, no verification/
recovery codes, no tokens, no session tokens. Those are owned entirely by Supabase
Auth. `profiles` holds only product/profile data and consent timestamps. RLS on
`profiles` is unchanged by this ADR.

## Routing gate

`resolvePostAuthDestination({ emailVerified, profile })`
(`packages/domain/src/routing.ts`) gates on **email verification first**:

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
- **Forgot-password is constant-response** ("If an account exists…") regardless of
  whether the email exists; only rate-limit / provider-unavailable failures
  surface.
- **Password policy** — min 8; upper, lower, number, special; **max 128**
  (design spec §10.5). Passwords longer than 128 produce a clear validation error;
  they are **never silently truncated**. Enforcement layers:
  1. **Client form** — live requirements checklist + strength meter + show/hide.
  2. **Shared zod schema** (`packages/domain/src/auth.ts`) — used by every auth
     form (sign-up, reset, admin reset).
  3. **Production server-side GoTrue** — a **platform follow-up**: the deployed
     platform configures and **independently validates** the server-side password
     policy. The pinned local Supabase CLI rejects password-policy config keys, so
     `supabase/config.toml` does **not** enforce the full policy locally. See the
     platform checklist in `infra/supabase/rds-compatibility-checklist.md`.
- **Audit metadata is generic** — passwords, codes, links, and tokens are never
  logged.

## Limitations (honest)

- **Session-expired detection is best-effort.** Expiry is surfaced via a
  `?expired=1` query hint on the sign-in route, not a guaranteed server signal.
- **Production server-side password policy is not yet configured/validated.**
  Locally only the client + shared schema enforce it (tracked in the platform
  checklist).
- **Demo Auth users get random UUIDs.** Because demo users are created through the
  Admin API (not SQL), their IDs are non-deterministic; integration tests resolve
  them **by email**, not by a hard-coded UUID.
- **Arabic legal copy is unreviewed.** The Terms/Privacy consent strings exist in
  `ar.json` but the legal wording is **not** yet business-reviewed and must not be
  represented as approved.

## Consequences

- Returning sign-in no longer depends on email deliverability.
- A real recovery flow exists and doubles as the transition path for legacy
  passwordless accounts.
- Two email templates must stay wired: `confirmation` (emits the 6-digit
  `{{ .Token }}`) and `recovery` (emits the official link to `/auth/confirm`).
- Recovery `redirectTo` must point at each app's own `/auth/confirm`, and those
  URLs must be allow-listed in the Auth redirect configuration.
- Demo provisioning moved out of SQL seed into the Admin-API script
  (`pnpm db:setup`) — see the demo runbook.
- Supersedes the passwordless-OTP description in Week 1 docs (ADR-0007's one-click
  demo fallback remains disabled and unaffected).
