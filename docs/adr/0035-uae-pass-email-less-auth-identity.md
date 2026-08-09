# ADR-0035 — UAE PASS uses an email-less Auth identity with allow-listed profile claims

- **Status:** Accepted; identity-retention detail refined by ADR-0036
- **Date:** 2026-08-09
- **Refines:** ADR-0033

## Context

UAE PASS Staging documents its `email` and `mobile` attributes as verified, but its
OAuth2 UserInfo response does not emit the OIDC `email_verified` boolean. Supabase
Auth therefore treated the returned email as unverified, created a partial Auth user,
sent MARKAZ's password-signup verification email, and rejected the provider callback
with `email_not_confirmed`. Disabling Confirm Email globally would also disable the
required six-digit verification gate for email/password accounts and is unacceptable.

The generic custom-provider decoder also discards provider-specific claims unless they
are explicitly allow-listed. The former SAML-shaped nested attribute mapping did not
normalize UAE PASS claims.

## Decision

- Keep Supabase Confirm Email enabled for email/password accounts.
- Configure `custom:uae-pass` with `email_optional=true` and map its top-level Auth
  email to `null`. UAE PASS Auth users are therefore email-less and never enter the
  password-account confirmation flow.
- Preserve only `email`, `fullnameEN`, `mobile`, `uuid`, `userType`, and `idn` through
  the custom provider's claim allow-list. Per ADR-0036, `idn` is used only to derive a
  private one-way match reference and is never copied into the application profile.
- Continue to resolve UAE PASS accounts by the provider subject, never by mutable email
  or mobile values.
- Project valid allow-listed contact attributes into the customer's RLS-protected
  application profile. Fill only missing profile data and never overwrite an existing
  customer's name, email, or mobile.
- Keep the synthetic non-deliverable profile email until a valid, non-conflicting UAE
  PASS contact email can be projected after the identity is persisted.

## Consequences

UAE PASS sign-in no longer sends a MARKAZ email-verification code or requires the
password signup verification screen. Email/password signup retains its six-digit code.
Provider-only accounts have no Auth email/password identity and continue to sign in by
their stable UAE PASS subject. Existing email/password customers must authenticate
their MARKAZ account before explicitly linking UAE PASS; MARKAZ does not merge Auth
accounts from contact attributes.
