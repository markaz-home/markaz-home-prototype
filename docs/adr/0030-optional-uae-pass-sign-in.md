# ADR-0030 — UAE PASS is optional sign-in, not customer onboarding

- **Status:** Accepted
- **Date:** 2026-08-02

## Context

Email/password signup previously ended at a mandatory third step that linked a
UAE PASS Staging identity. The link depends on environment-specific provider and
manual-linking configuration, so customers with a correctly verified email and
complete profile could still be blocked from the marketplace.

The existing UAE PASS Staging login on the Sign In screen works independently as
a Supabase custom OAuth provider and should remain available.

## Decision

- Email/password account setup is two steps: account details, then the six-digit
  email verification code.
- Successful verification shows Welcome and continues to Dashboard.
- Missing profile data still uses `/onboarding/profile`, then Dashboard.
- `/onboarding/uae-pass` is retired and redirects safely to Dashboard, whose
  server guard still enforces authentication, email verification, profile
  completeness, and the `CUSTOMER` account boundary.
- UAE PASS Staging remains an optional Sign In method. Its callback still
  establishes a normal Supabase session and honours the existing safe return
  allowlist.
- The identity-status schema and existing audit history remain available for future regulated
  workflows. Optional UAE PASS sign-in is represented by the Supabase Auth identity/session and
  does not require an application-profile status or gate customer access.
- `onboarding_completed_at` now means required profile details and consent are
  complete. Existing complete customer profiles are backfilled.

## Consequences

Customers are no longer blocked by staging identity-link configuration. Email
verification is not weakened: password signups must still confirm the Supabase
email code before reaching protected pages. UAE PASS production identity or
property verification remains outside this prototype.
