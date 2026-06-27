# MARKAZ Home — Week 1.5 Delivery Report

**Milestone: Authentication & Onboarding Hardening**

## Scope

Replace the Week 1 **passwordless email-OTP** sign-in with **email + password**,
and harden the onboarding gate. 6-digit email codes are retained **only** for
(a) verifying a new account and (b) password recovery. No SMS. No custom codes
are built or stored — Supabase Auth owns all credentials, codes, and tokens.
Full rationale: **[ADR-0009](docs/adr/0009-email-password-authentication.md)**.

This milestone does **not** build any Week 2 listing-journey surface.

## What changed

- **Sign-in is now email + password** (`signInWithPassword`), not OTP.
- **Sign-up collects a password** (+ confirm) and explicit Terms/Privacy consent,
  then verifies the email with a 6-digit code (`verifyOtp type:signup`).
- **Forgot/Reset password** flows added (web + admin), using a 6-digit recovery
  code (`verifyOtp type:recovery` → `updateUser` → sign out → fresh sign-in).
- **Routing gate now checks email verification first** — unverified/incomplete
  customers can never reach the dashboard.
- **Admin** uses email/password with **no public sign-up**; admins are created
  only by the provisioning script.
- **Demo provisioning moved from SQL seed to an Admin-API script** (`pnpm db:setup`).

## Routes

| App | Route | Status | Notes |
| --- | --- | --- | --- |
| web | `/[locale]/sign-up` | **added** | name, email, password, confirm, Terms, Privacy |
| web | `/[locale]/verify-email` | **added** | 6-digit signup code → `verifyOtp type:signup` |
| web | `/[locale]/forgot-password` | **added** | `resetPasswordForEmail`; generic response |
| web | `/[locale]/reset-password` | **added** | recovery code + new password |
| web | `/[locale]/sign-in` | **changed** | email + password (was OTP); `?reset=1`, `?expired=1` |
| web | profile-setup / onboarding | **fallback only** | normal path hydrates profile from metadata and skips it |
| admin | `/forgot-password` | **added** | |
| admin | `/reset-password` | **added** | |
| admin | `/login` | **changed** | email + password; requires `ADMIN` else `/access-denied` |

## Supabase configuration changes

- `enable_confirmations = true`.
- Email templates: `confirmation.html` + `recovery.html`, both carrying the
  6-digit `{{ .Token }}`. Confirmation is **not** disabled (tests read codes).
- Password policy (min 8 + upper/lower/number/special) is enforced in the app
  (client form + zod schema). The pinned local Supabase CLI rejects password-policy
  config keys, so the deployed platform owns the server-side GoTrue policy.
- Local mail inbox is **Mailpit** on newer CLIs (API
  `GET /api/v1/search?query=to:<email>` → `GET /api/v1/message/<id>`), not
  Inbucket; e2e tests use the Mailpit API.

## Migration changes (forward-only)

New migration `supabase/migrations/20260301000600_onboarding_metadata.sql`:

- Adds `profiles.onboarding_completed_at`.
- Updates `handle_new_user()` to hydrate `full_name` + consent timestamps from
  Auth `user_metadata`, so the normal sign-up path **skips** the profile-setup
  screen. `account_type` is still hard-coded `CUSTOMER` — public sign-up can
  never create an admin.

Drizzle schema (`packages/db/src/schema.ts`) updated to match. **RLS unchanged.**
No password hashes, codes, or tokens are stored in `profiles` (those live in
Supabase Auth).

## Duplicate-email behaviour

Supabase anti-enumeration: `signUp` for an existing **confirmed** email returns a
user with an **empty `identities[]`** and **no error**. `isLikelyExistingAccount`
detects this and shows safe copy + **Sign In** / **Forgot Password**. No
profiles-existence query, no enumeration endpoint, no raw DB errors. Profile
creation is idempotent (`handle_new_user`, `on conflict do nothing`).

## Password validation

Min 8; requires upper, lower, number, special; max 72 (provider bcrypt-safe
limit). Live requirements checklist + strength meter + show/hide; paste allowed.
Enforced in **three** layers: the client form, the zod schema
(`packages/domain/src/auth.ts`), and `supabase/config.toml`.

## Verification flow

`sign-up` → `signUp({ email, password, options:{ data:{ full_name,
terms_accepted, privacy_accepted } } })` → `verify-email` (enter 6-digit
`confirmation` code) → `verifyOtp({ type:'signup' })` → simulated UAE PASS →
dashboard.

## Recovery flow

`forgot-password` → `resetPasswordForEmail` (always the generic "If an account
exists…" message) → `reset-password` (enter 6-digit `recovery` code + new
password) → `verifyOtp({ type:'recovery' })` → `updateUser({ password })` →
**sign out** → `/sign-in?reset=1` ("Password updated"). Sign-out-after-reset is a
deliberate decision (ADR-0009): it keeps a recovery session from being treated as
a normal login and proves the new password works.

## Existing-user transition

Legacy passwordless accounts have no password. They set a first password via
**Forgot Password** (the recovery code proves email access). No bulk migration.

## Admin provisioning

No public admin sign-up. Admins are created **only** by
`packages/db/src/scripts/setup-demo.ts` (`pnpm db:setup`) via the Supabase Admin
API, which then promotes `account_type = 'ADMIN'`. The post-sign-in gate requires
`ADMIN`, else `/access-denied` (emits `ADMIN_ACCESS_DENIED`).

## Audit events added

- **Server-side:** `ACCOUNT_PROFILE_COMPLETED`, `DEMO_IDENTITY_STARTED`,
  `DEMO_IDENTITY_VERIFIED`, `DEMO_IDENTITY_FAILED`.
- **Client-emitted** (allow-listed `audit.record` tRPC procedure): `EMAIL_VERIFIED`,
  `CUSTOMER_SIGNED_OUT`, `ADMIN_ACCESS_DENIED`.
- Generic metadata only — **never** passwords, codes, or tokens.

## Demo provisioning (changed)

`supabase/seed.sql` no longer creates Auth users or demo domain data (writing
Auth tables via SQL is unsupported). Instead `setup-demo.ts` (`pnpm db:setup`):

1. Creates Customer A, Customer B, Admin via `auth.admin.createUser`
   (`email_confirm: true`, passwords from `DEMO_*` env with local defaults,
   metadata) — **idempotently**.
2. Promotes the admin (`account_type = 'ADMIN'`), marks both customers
   `VERIFIED_DEMO`, and seeds demo domain data via the direct DB.
3. **Refuses to run** when `DEMO_ENVIRONMENT=production` or `NODE_ENV=production`.

New local flow: `pnpm supabase:reset && pnpm db:setup`. Demo IDs are now random
UUIDs (Admin-API generated); integration tests resolve them **by email**. Demo
credentials and reset steps: **[docs/runbooks/demo-runbook.md](docs/runbooks/demo-runbook.md)**.

## Test results

| Suite | Status |
| --- | --- |
| Unit (`packages/*`) | ✅ pass |
| Component (`apps/*/src/__tests__`) | ✅ pass |
| Integration (RLS/storage + auth provisioning) | requires the local Supabase stack + `pnpm db:setup` |
| e2e (Playwright) | requires the local stack + `pnpm db:setup` (reads codes from Mailpit) |

Integration and e2e are gated on a running local stack and a completed
`pnpm db:setup`; they self-skip / fail fast without it.

## Known limitations

- **Session-expired detection is best-effort** — surfaced via `?expired=1`, not a
  guaranteed server signal.
- **Demo Auth users have random UUIDs** — tests resolve by email, not fixed IDs.
- **Arabic legal copy is unreviewed** — Terms/Privacy consent strings exist but
  are **not** legally/business-reviewed; do not represent them as approved.
- Demo-auth one-click fallback remains **disabled** (ADR-0007), unaffected here.

## Manual verification checklist (milestone Step 24)

- [ ] **Customer sign-up:** create an account → receive the `confirmation` code in
      Mailpit → verify → simulated UAE PASS → dashboard.
- [ ] **Duplicate email:** sign up again with the same confirmed email → safe
      "account exists" copy with **Sign In** / **Forgot Password**, no error/leak.
- [ ] **Sign-in:** correct credentials reach the dashboard; wrong credentials show
      the single generic "The email or password is incorrect."; an unverified
      account routes to verify-email.
- [ ] **Recovery:** forgot-password shows the generic message; reset-password with
      the `recovery` code + a new password signs you out → `/sign-in?reset=1` shows
      "Password updated"; the new password works; the old one does not.
- [ ] **Admin:** `admin@markaz.demo` signs in to the admin app; a CUSTOMER signing
      in there hits `/access-denied` (and an `ADMIN_ACCESS_DENIED` audit event);
      there is no public admin sign-up.
- [ ] **Localisation:** all of the above render correctly in **en** and **ar**
      (RTL), with no hardcoded strings or hardcoded left/right.

## Readiness for Week 2 (property-listing journey)

The auth and onboarding foundation is complete and stable: email/password,
verified-email gate, idempotent profile creation, RLS unchanged, demo
provisioning via the Admin API. The Week 2 listing journey
(`DRAFT → … → READY_TO_PUBLISH`) builds on this **without any further auth
restructuring**.
