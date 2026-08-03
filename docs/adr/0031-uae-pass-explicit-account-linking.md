# ADR-0031 — UAE PASS uses explicit account linking

- **Status:** Accepted
- **Date:** 2026-08-03

## Context

The public UAE PASS staging UserInfo response includes an optional email but does not
advertise an `email_verified` claim. A first-time Supabase custom-provider sign-in can
therefore create an email-less Auth user instead of safely linking to the customer's
verified email/password account. That hidden user owns the UAE PASS provider subject and
can make later email signup or manual linking appear stale or duplicated.

UAE PASS must remain optional and must not return as a mandatory signup step (ADR-0030).

## Decision

- Email/password plus the six-digit email code remains the only customer signup path.
- UAE PASS Staging is linked only from **Profile → Sign-in methods** while the customer is
  authenticated with a verified, complete account.
- Supabase manual identity linking is enabled for this explicit action.
- A Before User Created Auth hook rejects `custom:uae-pass` when GoTrue would create a new
  user. It returns a stable, non-enumerating marker and does not create application data.
- The hook does not run for an authenticated `linkIdentity` target or an existing linked
  provider subject, so those flows continue normally.
- A successful OAuth code exchange is the account-link success boundary because GoTrue
  has already persisted the canonical `auth.identities` row. The callback returns to
  Profile immediately; it does not wait on application-table writes.
- Profile records `VERIFIED_STAGING` through the existing
  `sync_uae_pass_staging_identity()` database function, which derives `auth.uid()` and
  verifies the canonical `auth.identities` row. The page retries this idempotent,
  lock-bounded synchronization when the provider identity exists but the profile record
  is still pending.
- An unknown UAE PASS sign-in returns the user to email/password Sign In and then Profile,
  where the identity can be linked deliberately. No email-based merge is implemented.

## Consequences

One customer has one Supabase user and profile with multiple sign-in identities. Unknown
UAE PASS subjects cannot create hidden email-less customers. Existing orphan identities
created before this hook require one-time Auth Admin cleanup before they can be linked.
Production UAE PASS onboarding and identity-assurance claims remain outside this staging
prototype.
