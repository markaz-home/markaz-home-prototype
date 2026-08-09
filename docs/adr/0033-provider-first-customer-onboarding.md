# ADR-0033 — Provider-first customer onboarding

- **Status:** Superseded in part by ADR-0034 (Google removed); refined by ADR-0035
- **Date:** 2026-08-06
- **Supersedes:** ADR-0031's UAE PASS login-only restriction
- **Refines:** ADR-0009 and ADR-0030

## Context

MARKAZ originally required email/password registration before a customer could link UAE PASS.
That prevented hidden email-less staging users, but it also forced a redundant account-creation
step. Dubai REST and other UAE services establish the expected local pattern: UAE PASS can be the
first authentication, approved attributes prefill the service profile, and the service collects
only its own missing fields and consent.

Google is a second optional provider. Email/password with the six-digit signup code remains fully
supported. All three paths must converge on one `auth.users` identity owner and one CUSTOMER
`profiles` row.

## Decision

- Sign Up and Sign In expose the same enabled provider actions: **Continue with UAE PASS** and
  **Continue with Google**. A provider subject signs in when known and creates a CUSTOMER when new.
- **Refinement (2026-08-07):** a Sign-Up-page provider action that resolves to an **established**
  customer (complete profile: name + both consents) does not silently sign in. The callback ends
  the session and returns to Sign In with an `already_registered` notice ("You already have a
  Markaz account"), keeping Sign Up semantically "create an account". Detection uses only the
  authenticated user's own RLS-scoped profile — never a browser-supplied email or phone — so the
  anti-enumeration stance is unchanged. Incomplete accounts (an abandoned first attempt) continue
  to onboarding, and Sign-In-page provider actions are unaffected.
- Supabase Auth owns provider subject resolution and canonical `auth.identities` rows. MARKAZ never
  resolves or merges identities from a browser-supplied email, phone, or Emirates ID.
- Google uses its provider subject. UAE PASS uses its canonical provider subject and retains the
  approved UAE PASS UUID in Auth identity data. Email/mobile are mutable contact attributes, never
  durable account keys.
- Successful Google/UAE PASS authentication satisfies the password-email authentication gate, but
  never satisfies MARKAZ Terms/Privacy consent. New provider users continue to Profile Setup, where
  prefilled details are reviewed and missing required MARKAZ details are collected.
- The application projection is deliberately minimal: English full name, email, and mobile when
  supplied. UAE PASS mobile is normalized to E.164 and records UAE PASS verification provenance.
  **Emirates ID is not copied into application tables.** Raw provider tokens are never stored.
- Synchronization fills missing profile fields only. Linking a provider never overwrites an
  existing name, email, or phone.
- Supabase's verified-email automatic linking may apply where the provider and GoTrue establish a
  verified email (notably Google). Otherwise, customers authenticate their existing MARKAZ account
  and use explicit identity linking. Provider conflicts receive non-enumerating copy.
- Google button visibility is server-controlled and enabled only after the Google OAuth client and
  matching Supabase Auth provider are configured for that environment.
- UAE PASS Staging remains a staging POC, not production identity/property verification. Production
  requires UAE PASS onboarding approval, issued credentials/scopes, and reviewed assurance.

## Consequences

Customers can start with the identity method they already trust without creating a redundant
password. RLS continues to see one `auth.uid()` regardless of sign-in method. Provider-only accounts
do not implicitly have a MARKAZ password; password recovery applies only after a password identity
exists. The callback and synchronization remain idempotent and accept no provider profile data from
query parameters or browser input.
