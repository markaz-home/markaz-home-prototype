# ADR-0025 — Two-state account restriction (Week 6)

## Status
Accepted (Week 6).

## Context
Operations must be able to stop a customer from taking new consequential actions during an
investigation, without banning sign-in, hiding their public listings, or deleting data.

## Decision
A two-state flag on `profiles` (`ACTIVE` / `ACTIONS_RESTRICTED`) with
`restricted_at`/`restriction_reason`/`restricted_by`. `is_restricted(uid)` (SECURITY
DEFINER) is folded into the offer/listing/publication write functions, which raise
`ACCOUNT_RESTRICTED`. Restriction is set **only** by `admin_restrict_customer` /
`admin_restore_customer`; `guard_profile_restriction()` blocks the `authenticated`/`anon`
roles from setting it directly. Restriction does **not** affect sign-in, browsing, public
listings, or existing transactions' read access.

## Consequences
A reversible, audited, narrowly-scoped brake — not a ban. Reasons are a closed enum. The
guard keeps the flag server-authoritative. See ADR-0026.
