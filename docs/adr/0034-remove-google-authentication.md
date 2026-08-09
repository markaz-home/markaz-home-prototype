# ADR-0034 — Remove Google authentication

- **Status:** Accepted
- **Date:** 2026-08-09
- **Supersedes:** ADR-0033 only where it enabled Google authentication

## Context

MARKAZ previously exposed Google as an optional Supabase Auth provider alongside email/password
and UAE PASS. The product now requires exactly two customer authentication paths: email/password
and UAE PASS.

## Decision

- Remove Google from Sign Up, Sign In, onboarding, Profile, configuration discovery, translations,
  tests, environment contracts, and operational runbooks.
- Keep email/password and UAE PASS behavior unchanged.
- Explicitly disable `[auth.external.google]` in `supabase/config.toml` so linked-project config
  pushes disable the provider as well as hiding its application entry point.
- The OAuth callback accepts only UAE PASS flows and signs out any exchanged session that does not
  contain a canonical UAE PASS identity. Email verification and recovery continue through the
  separate `/auth/confirm` route.
- Do not rewrite already-applied migration history. Historical migrations and ADRs may still name
  Google when describing the state that existed when they were accepted.

## Consequences

Customers can authenticate only with email/password or UAE PASS. An accidentally enabled external
OAuth provider cannot complete the MARKAZ application callback. Existing Google-linked accounts
must use another approved identity after the provider is disabled; the requested environment reset
removes current hosted Auth users before new accounts are created.
