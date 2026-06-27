# ADR 0002: Unified Customer Account (Buyer/Seller are Journeys, not Roles)

- **Status:** Accepted
- **Date:** 2026-03

## Context

A property marketplace has people who buy and people who sell. The common
modeling mistake is to treat "buyer" and "seller" as account roles chosen at
signup, which forces a role-selection step, per-role onboarding, per-role
navigation, and per-journey authorization guards. In practice the same person
both lists a property and makes offers on others, often in the same session.

## Decision

There are exactly **two account types**: `CUSTOMER` and `ADMIN`.

- **Buyer and Seller are journeys, not roles.** Every `CUSTOMER` can both buy and
  sell with no role selection and no per-journey guards.
- There is **no buyer/seller selection** at signup or anywhere else.
- `ADMIN` is a separate account type used only by the separate admin application
  (see ADR 0008). The customer app exposes no admin routes or navigation.
- The `account_type` enum is enforced in the database; customers cannot
  self-promote to admin (a `prevent_account_type_escalation()` trigger blocks it,
  see ADR 0003 / ADR 0004).

Authorization is therefore about **ownership and resource state**, not journey:
a customer may read/write the rows they own, read public `LIVE` listings, and
make offers on listings that are not their own. These are enforced by RLS
policies, not by app-level journey guards.

## Consequences

- Simpler onboarding: landing → email → OTP → profile setup → simulated UAE PASS
  → dashboard, with no role fork.
- Simpler authorization surface: ownership-based RLS replaces a matrix of
  per-role/per-journey guards.
- The same dashboard serves both selling and buying activity for a customer.
- "Can this customer make an offer on this listing?" becomes a data rule
  (not your own listing, listing is `LIVE`) rather than a role check — enforced
  by `enforce_offer_not_on_own_listing()` and an insert policy.
- Admin capability is physically isolated in a different app and deployment, not
  guarded by an in-app role switch.
