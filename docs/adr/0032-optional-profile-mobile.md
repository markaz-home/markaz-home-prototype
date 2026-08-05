# ADR-0032 — Mobile is optional profile contact data, not identity

- **Status:** Accepted
- **Date:** 2026-08-05

## Context

Customers benefit from completing more of their account after email verification, but UAE PASS
must remain optional and MARKAZ must not confuse a contact number with an authentication or
identity-linking key. UAE PASS lets a person start its own login using email, mobile, or Emirates
ID; after authentication, the provider subject/UUID is the durable identity seen by MARKAZ.
Email and mobile can change and are therefore unsafe permanent linking keys.

## Decision

- Email + password remains the only native MARKAZ customer sign-in method.
- After verification, Dashboard may show a dismissible account-setup prompt for two optional
  actions: add a contact mobile and link UAE PASS.
- Neither optional action changes `resolvePostAuthDestination` or blocks access to Dashboard.
- `profiles.phone_e164` stores an optional E.164 contact number. It is not unique and is never
  used to resolve accounts, sign in, recover a password, or link UAE PASS.
- `phone_verified_at` and `phone_verification_source` remain null until a separately reviewed
  MARKAZ OTP or UAE PASS verification workflow proves the current number. Changing the number
  clears both fields.
- The profile audit event records only the names of changed fields, never contact values.
- UAE PASS linking continues to use the canonical provider subject in `auth.identities` through
  explicit linking while already signed in (ADR-0031). Provider email/mobile never silently
  updates the MARKAZ profile.
- Emirates ID is not copied into application tables. Production identity integration requires a
  reviewed, minimized attribute contract before real identities are allowed.

## Consequences

Entering a mobile, email, or Emirates ID on UAE PASS's own screen can still resolve a previously
linked MARKAZ account because the returned provider subject is stable. Merely adding a contact
mobile to MARKAZ does not enable phone login. Native phone authentication would require a separate
decision covering OTP delivery, verified uniqueness, recovery, abuse controls, and migration of
existing accounts.

The Arabic copy introduced with this experience is draft and requires language/business review.
