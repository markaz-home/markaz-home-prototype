# ADR-0036 — UAE PASS Emirates ID is retained only as a private match reference

- **Status:** Accepted
- **Date:** 2026-08-09
- **Refines:** ADR-0032, ADR-0033, ADR-0035

## Context

UAE PASS documents `idn` as the verified Emirates ID attribute available for
Citizen/Resident SOP2 and SOP3 identities. MARKAZ may later need to determine whether
an Emirates ID entered in a separately approved identity workflow matches the identity
previously authenticated by UAE PASS. The number is sensitive, must not become ordinary
profile data, and is not needed for display, search, account resolution, or Admin work.

Because UAE PASS Auth users intentionally have no `auth.users.email`, GoTrue's native
email uniqueness does not detect a later password signup using the verified contact email
projected into `public.profiles`. Without an earlier guard, that attempt can create a
second Auth identity and fail only when the profile trigger reaches the unique email index.

## Decision

- Add `idn` to the minimal custom-provider allow-list solely for server-side identity
  synchronization. Do not accept it from browser input or query parameters.
- Normalize the trusted UAE PASS value and retain only a salted bcrypt match reference in
  `private.customer_identity_references`. Do not copy a raw Emirates ID or its hash into
  `public.profiles`, DTOs, Admin APIs, audit metadata, logs, analytics, or UI.
- Keep the `private` schema outside PostgREST's exposed schemas. Revoke schema/table access
  from `anon` and `authenticated`, enable and force RLS, and define no customer policies.
- Use the reference only for a future equality check. It is not an account-linking key and
  cannot replace the canonical UAE PASS provider subject.
- Configure Supabase's Before User Created hook to compare a new Auth user's normalized
  email with the existing RLS-protected profile emails. On a match, reject before insertion
  with a stable, non-identifying marker.
- Give `supabase_auth_admin` only `SELECT(email)` plus a role-specific RLS policy. The hook
  remains security-invoker and is not executable by customer or anonymous roles.
- Map the marker to the same safe “You may already have an account” Sign Up state. Sign In
  continues to return one generic incorrect-email-or-password message.

## Consequences

MARKAZ can later confirm an entered number against the retained reference without rendering
or recovering the Emirates ID. The provider's raw claim remains confined to Supabase Auth's
internal identity metadata; the application database stores only the one-way reference.
Password signup cannot create a parallel account for an email already projected from UAE
PASS, while the public response does not disclose whether the email or provider exists.

Existing UAE PASS identities created before this change receive the reference only after a
fresh UAE PASS authentication updates the allow-listed provider claims and the normal
identity synchronization runs again. Visitor/SOP1 identities without `idn` remain valid and
simply have no reference row.
