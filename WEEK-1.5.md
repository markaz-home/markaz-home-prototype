# MARKAZ Home — Week 1.5 Delivery Report

**Milestone: Authentication & Onboarding Hardening (closure & acceptance)**

This report describes the **final** implementation. It is internally consistent:
there are no "where these sections conflict" override notes. The authoritative
decision record is **[ADR-0009](docs/adr/0009-email-password-authentication.md)**;
the UI follows **`docs/design/auth-onboarding-design-spec.md`**.

## 1. Milestone scope

Replace the Week 1 **passwordless email-OTP** sign-in with **email + password**,
and harden the onboarding gate, to design-spec fidelity. This milestone does
**not** build any Week 2 listing-journey surface (no listing wizard, marketplace,
offers, or transactions UX).

The two email artefacts are split strictly by purpose:

```
Six-digit email code      → new-account email verification only
Official Supabase link    → Forgot Password and Reset Password
```

No SMS. No custom codes, passwords, hashes, or tokens are built, stored, or logged
by app code — Supabase Auth owns them all.

## 2. Final authentication decision

- **Sign-in:** email + password via `supabase.auth.signInWithPassword`.
- **New-account verification:** 6-digit code via `verifyOtp({ type:'signup' })`
  (from the `confirmation` email template).
- **Password recovery:** the **official Supabase recovery LINK** —
  `resetPasswordForEmail` → email link → `/auth/confirm` verifies the recovery
  token → `/reset-password` (valid recovery session only) → `updateUser` → **sign
  out** → fresh sign-in. **There is no recovery-code input anywhere.**
- **Admin:** email + password, **no public sign-up**; admins are provisioned only
  by `pnpm db:setup`.

## 3. Final route inventory

### Customer app (`apps/web`, port 3000)

| Route                                                                        | Notes                                                             |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `/[locale]/sign-up`                                                          | name, email, password, confirm, Terms, Privacy → `signUp`         |
| `/[locale]/sign-up/check-email`                                              | "Check your email" (verification code sent)                       |
| `/[locale]/verify-email` (+ `/success`)                                      | 6-digit signup code → `verifyOtp type:signup`                     |
| `/[locale]/sign-in`                                                          | email + password; `?reset=…`, `?expired=1` hints                  |
| `/[locale]/forgot-password` (+ `/check-email`)                               | `resetPasswordForEmail`; generic response                         |
| `/auth/confirm`                                                              | **top-level** (outside `[locale]`) recovery/confirmation callback |
| `/[locale]/reset-password` (+ `/success`)                                    | new password only — **no code field**; recovery-session gated     |
| `/[locale]/onboarding/uae-pass`                                              | simulated UAE PASS; `/onboarding/profile` is a fallback           |
| `/[locale]/signed-out`, `/[locale]/auth/error`, `/[locale]/auth/unavailable` | status panels                                                     |
| `/[locale]/dashboard`                                                        | reached only by verified + complete customers                     |

### Admin app (`apps/admin`, port 3001)

| Route                                             | Notes                                                      |
| ------------------------------------------------- | ---------------------------------------------------------- |
| `/[locale]/login`                                 | email + password; requires `ADMIN` else `/access-denied`   |
| `/[locale]/forgot-password` (+ `/check-email`)    | admin recovery (official link)                             |
| `/auth/confirm`                                   | **top-level** recovery callback (returns to the admin app) |
| `/[locale]/reset-password` (+ `/success`)         | new admin password — **no code field**                     |
| `/[locale]/access-denied`, `/[locale]/signed-out` | status panels                                              |
| `/[locale]/overview` + portal sections            | admin portal (Operations shell)                            |

The locale-independent `/auth/confirm` callback is intentional and documented
(middleware excludes `/auth` from locale routing; ADR-0009).

## 4. Final sign-up flow

`sign-up` → `signUp({ email, password, options:{ data:{ full_name,
terms_accepted, privacy_accepted } } })` → `sign-up/check-email` → `verify-email`.
`handle_new_user` hydrates `full_name` + consent from Auth metadata, so the normal
path **skips** profile-setup. `account_type` is hard-coded `CUSTOMER` — public
sign-up can never create an admin.

## 5. Final email-verification flow

`verify-email` (enter the 6-digit `confirmation` code) → `verifyOtp({
type:'signup' })` → `verify-email/success` → simulated UAE PASS → (success screen,
"Go to dashboard") → dashboard. Weak-password, invalid-code, expired-code, resend,
and rate-limit states are surfaced with safe, non-enumerating copy.

## 6. Final sign-in flow

`sign-in` (email + password) → `signInWithPassword`. Bad credentials return a
single generic message — "The email or password is incorrect." — never revealing
which field was wrong or whether the account exists. `email_not_confirmed` is the
one acted-on case: it routes to `verify-email`. A verified, complete customer goes
straight to the dashboard.

## 7. Final password-recovery-link flow

`forgot-password` → `resetPasswordForEmail(email, { redirectTo:
<origin>/auth/confirm })` → **always** the generic "If an account exists…" message
(anti-enumeration) → `forgot-password/check-email`. The recovery email contains a
**link**; `/auth/confirm` runs `verifyOtp({ type:'recovery', token_hash })`
(establishing the recovery session in secure cookies) → `/reset-password`. That
page renders **only** with a valid recovery session (otherwise an invalid-link
panel) and asks for a **new password only** → `updateUser({ password })` → **sign
out** → `/reset-password/success` → fresh sign-in with the new password.

**Sign-out-after-reset is deliberate** (ADR-0009): it keeps a recovery session
from being treated as a normal login and proves the new password works. Invalid,
missing, reused, or expired links — and direct access to `/reset-password` without
a recovery session — all land on the invalid-link panel; no password is changed.

## 8. Final existing-user transition

A legacy passwordless account (no password) sets a **first** password through the
same recovery-link flow: Forgot Password → recovery email link → `/auth/confirm`
→ Reset Password → sign out → sign in with email + new password. No bulk migration;
the recovery link **is** the transition path. (The recovery-link flow is identical
whether or not a password already existed, so the e2e recovery test exercises the
exact mechanism — see §15.)

## 9. Password requirements: 8–128

Min 8; at least one uppercase, lowercase, number, and special character; **max
128** (design spec §10.5). Passwords longer than 128 produce a clear validation
error under the field — **never a silent truncation**. A live requirements
checklist + 3-level strength meter + show/hide guide the user; pasting is allowed.

## 10. Accurate enforcement layers

The application policy is enforced at two layers **today**:

1. **Client form** — live checklist + strength meter; submit blocked until valid.
2. **Shared zod schema** — `packages/domain/src/auth.ts` (`passwordSchema`,
   `signUpSchema`, `resetPasswordSchema`), used by sign-up, reset, and admin reset.

**Not enforced locally:** the pinned local Supabase CLI **rejects** password-policy
config keys, so `supabase/config.toml` does **not** enforce the full policy.
**Platform follow-up** (tracked in
`infra/supabase/rds-compatibility-checklist.md`): configure the **production
server-side GoTrue** password policy, confirm which keys the deployed GoTrue
version supports, and **independently verify** that production rejects a
non-compliant password with the client bypassed (no silent truncation). This is a
checklist item, not a completed claim.

## 11. Duplicate-email behaviour (enumeration-aware)

Both GoTrue behaviours are handled:

- **Obfuscated** — `signUp` for an already-confirmed email returns a user with an
  **empty `identities[]`** and no error (`isLikelyExistingAccount`).
- **Explicit** — a `422 user_already_exists` / `email_exists` error
  (`isExistingAccountError`).

Either path shows the safe "you may already have an account" copy with **Sign In**
/ **Forgot Password** — no profiles-existence query, no enumeration endpoint, no
raw DB errors. Profile creation is idempotent (`handle_new_user`, `on conflict do
nothing`), so a re-attempt cannot duplicate a row (verified by integration test).

## 12. Admin provisioning and login

No public admin sign-up. Admins are created **only** by
`packages/db/src/scripts/setup-demo.ts` (`pnpm db:setup`) via the Supabase Admin
API, which then promotes `account_type = 'ADMIN'`. The post-sign-in gate requires
`ADMIN`, else `/access-denied` (emits `ADMIN_ACCESS_DENIED`). Admin recovery uses
the official link and returns to the **admin** app's `/auth/confirm`; customer
recovery returns to the **customer** app's.

## 13. Supabase configuration

- `enable_confirmations = true`; `otp_length = 6`.
- Templates (wired in `config.toml [auth.email.template.*]`):
  - `confirmation.html` — carries the **6-digit `{{ .Token }}`** (verification).
  - `recovery.html` — carries the **official link**
    `{{ .RedirectTo }}/auth/confirm?token_hash=…&type=recovery&next=/reset-password`.
- `additional_redirect_urls` allow the web (`:3000`) and admin (`:3001`) origins;
  the `/auth/confirm` recovery redirect is accepted (verified — recovery e2e
  passes end-to-end).
- Password policy is enforced in the app, **not** in `config.toml` (see §10).
- Local mail inbox is **Mailpit** on newer CLIs (API `GET /api/v1/search?query=to:…`
  → `GET /api/v1/message/<id>`); e2e reads the **code** for verification and the
  **link** for recovery from it — never a public inbox.

## 14. Migrations

Canonical SQL history in `supabase/migrations/` (6 migrations); Drizzle
(`packages/db/src/schema.ts`) mirrors it. The Week-1.5 migration
`20260301000600_onboarding_metadata.sql` adds `profiles.onboarding_completed_at`
and updates `handle_new_user()` to hydrate `full_name` + consent from Auth
metadata (so normal sign-up skips profile-setup). `account_type` stays hard-coded
`CUSTOMER`. **RLS unchanged.** No password hashes, codes, or tokens are stored in
`profiles` — those live in Supabase Auth. `pnpm supabase:reset` applied all 6
migrations cleanly during validation.

## 15. Tests and exact results

Validated against a clean local Supabase stack (`pnpm supabase:reset && pnpm
db:setup`) on 2026-06-29. Exact commands and results:

| Command / suite                                                               | Result                            |
| ----------------------------------------------------------------------------- | --------------------------------- |
| `pnpm typecheck`                                                              | ✅ 12/12 packages                 |
| `pnpm lint`                                                                   | ✅ 11/11 packages                 |
| `pnpm test` (unit + component + integration)                                  | ✅ **86 tests** across 8 packages |
| &nbsp;&nbsp;`@markaz/domain` (unit)                                           | ✅ 22                             |
| &nbsp;&nbsp;`@markaz/web` (component)                                         | ✅ 31                             |
| &nbsp;&nbsp;`@markaz/admin` (component)                                       | ✅ 7                              |
| &nbsp;&nbsp;`@markaz/auth` (unit)                                             | ✅ 5                              |
| &nbsp;&nbsp;`@markaz/i18n` (unit)                                             | ✅ 6                              |
| &nbsp;&nbsp;`@markaz/tests` (integration: RLS 9 + storage 3 + provisioning 3) | ✅ 15                             |
| `pnpm test:e2e` (Playwright, live stack + Mailpit)                            | ✅ **10/10**                      |
| `pnpm build` (web + admin)                                                    | ✅ both compiled successfully     |

- **Skipped:** none. Integration and e2e ran against the **active** local stack
  (not self-skipped).
- **Failed:** none (after fixes — see below).

New / updated tests this milestone:

- **Unit** (`packages/domain`): password min(8) **and max(128)** bounds with a
  129-char rejection (no truncation); reset-password schema requires matching
  confirmation; existing coverage for policy, post-auth destination, safe
  duplicate-email mapping (both behaviours), recovery error mapping.
- **Component** (`apps/web`, `apps/admin`): Forgot Password sends the official link
  with a `/auth/confirm` redirect and shows the generic confirmation; Reset
  Password renders **no code field**, updates the password, signs out, and routes
  to success; **>128-char** password is rejected under the field; Admin recovery
  mirror; English + Arabic recovery copy.
- **E2E** (`apps/web/e2e/auth-password.spec.ts`): new-account verification via the
  6-digit signup code; recovery via the **official link** → reset → old password
  fails / new password works; duplicate email handled safely; generic sign-in
  error; customer cannot reach the admin app.

Fixes made during validation:

1. **UAE PASS success screen does not auto-redirect** (design spec §16.6) — the
   e2e signup test now clicks "Go to dashboard" (test was missing the step).
2. **Recovery e2e idempotency** — the new password is unique per run so a re-run
   never sets the same password twice (GoTrue rejects "new == current").
3. **`foundation.spec.ts`** — the landing CTA test referenced a removed
   "Get started" link; updated to the current "Sign in" route and heading.
4. **WCAG AA contrast** — `--muted-foreground` was `#647482` (4.47:1 on the
   off-white canvas, just under AA). Darkened to `208 15% 41%` (~5.2:1). This token
   is used across the auth/onboarding screens, so it is a genuine accessibility fix,
   not a redesign.

## 16. Validation results (how each was verified)

Validated on 2026-06-29 against a clean stack (`pnpm supabase:reset && pnpm
db:setup`). The e2e suite ran in a headless browser against production builds of
both apps; each item below names its evidence (E2E / component / integration /
server-side code guard).

- **New customer** (sign up → `confirmation` code from Mailpit → verify → simulated
  UAE PASS → "Go to dashboard" → dashboard): **E2E** ✅.
- **Duplicate email** (safe copy with Sign In / Forgot Password; no duplicate Auth
  user; no duplicate profile): **E2E** (safe copy) + **integration** (idempotent
  profile) ✅.
- **Sign-in** (correct → dashboard; wrong → single generic error): **E2E** ✅;
  `email_not_confirmed → verify-email` is a code guard (`sign-in-form`).
- **Recovery link** (generic confirmation → **link** in Mailpit → `/auth/confirm`
  → reset → signed out → **old password fails, new password works**): **E2E** ✅
  (asserts both old-fails and new-works).
- **Invalid / direct recovery** (invalid link, or `/reset-password` without a
  recovery session → invalid-link panel, no reset): server-side **code guard**
  (`reset-password/page.tsx` checks `getAuthUser()` + `?error=invalid`) +
  **component** (reset form renders **no code field**).
- **Admin** (admin → Overview; CUSTOMER in admin → access-denied; no public admin
  sign-up): **E2E** (customer cannot reach admin) + **component** (admin sign-in) +
  **code guard** (`requireAdmin`). Recovery `redirectTo` is each app's own
  `/auth/confirm`, so customer/admin recoveries return to their own app.
- **Session / onboarding** (unverified/incomplete never reach the dashboard; UAE
  PASS resume; `?expired=1` panel): **E2E** (protected route → sign-in) +
  server-side **code guard** (`requireCustomerStep`, `resolvePostAuthDestination`,
  unit-tested). The UAE PASS pending/failure resume and the session-expired panel
  are rendered by the same guarded components and were not separately clicked
  through in a manual browser session this run.
- **Localisation** (en + ar, RTL; password fields LTR; no stale recovery-code
  text): **E2E** (ar RTL toggle) + **component** (ar renders for sign-up, sign-in,
  forgot, reset, admin reset) + repo-wide grep (no stale recovery-code strings).

## 17. Remaining limitations

- **Session-expired detection is best-effort** — surfaced via `?expired=1`, not a
  guaranteed server signal.
- **Production server-side password policy is a platform follow-up** — locally only
  the client + shared schema enforce it (§10).
- **Arabic legal copy is unreviewed** — Terms/Privacy consent strings exist but are
  **not** legally/business-reviewed; do not represent them as approved.
- **Demo Auth users have random UUIDs** — tests resolve them by email.
- **Self-hosted-Supabase-on-RDS is not validated** (ADR-0006); demo-auth one-click
  fallback remains disabled (ADR-0007).

## 18. Acceptance checklist (actual status)

- [x] Password recovery uses the official Supabase email **link**.
- [x] Six-digit codes are used **only** for sign-up email verification.
- [x] No recovery-code input or stale recovery-code documentation remains.
- [x] Password maximum is consistently **128**; no 72-char / bcrypt-limit wording.
- [x] Password-policy enforcement is described accurately (client + shared schema
      now; production GoTrue is a platform follow-up).
- [x] Recovery templates and redirect URLs work (recovery e2e passes end-to-end).
- [x] New-customer verification works (6-digit code).
- [x] Duplicate-email handled safely (both GoTrue behaviours).
- [x] Sign-in works; generic error on bad credentials.
- [x] Recovery works; **old password fails**, new password works after reset.
- [x] Legacy passwordless transition works via the recovery link.
- [x] Admin recovery works; customer/admin isolation intact.
- [x] English, Arabic, and RTL work; password fields LTR.
- [x] Existing RLS and Storage tests pass. The Realtime foundation was not
      modified, its migration reapplied successfully, but the browser proof should
      be manually rechecked before the next demo.
- [x] Integration **and** e2e ran against the **active** local stack.
- [x] `pnpm lint`, `pnpm typecheck`, web build, admin build all pass.
- [x] ADR-0009 accurate; `WEEK-1.5.md` internally consistent.
- [x] No secrets, passwords, codes, or tokens committed or logged.

## 19. Readiness for Week 2 (property-listing journey)

The auth and onboarding foundation is complete, accurate, and stable:
email/password sign-in, a 6-digit verification code, official-link recovery, the
verified-email gate, idempotent profile creation, RLS unchanged, and demo
provisioning via the Admin API. The Week 2 listing journey
(`DRAFT → … → READY_TO_PUBLISH`) builds on this **without any further auth
restructuring**.
