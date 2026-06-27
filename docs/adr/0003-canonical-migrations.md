# ADR 0003: Canonical SQL Migrations with Drizzle as the Typed Layer

- **Status:** Accepted
- **Date:** 2026-03

## Context

We use Drizzle ORM for typed queries, and Supabase for auth/realtime/storage.
Both can generate or apply schema changes. If two mechanisms apply schema
(Drizzle migrations *and* Supabase SQL migrations), they will drift, and
RLS policies, triggers, grants, and Supabase-specific objects (auth/storage
schemas, realtime publication) do not map cleanly onto ORM-generated migrations.

## Decision

There is a **single ordered SQL migration history** in `supabase/migrations/`,
and it is the only thing ever applied to a database.

Canonical migrations (Week 1):

- `20260301000100_profiles_foundation.sql` — enums (`account_type`,
  `identity_verification_status`), `profiles` table, `updated_at` trigger,
  `handle_new_user()` trigger on `auth.users` (idempotent CUSTOMER-default
  profile creation), `prevent_account_type_escalation()` trigger, `is_admin()`
  SECURITY DEFINER, profiles RLS policies, grants.
- `20260301000200_marketplace_tables.sql` — properties, listings,
  ownership_documents, verifications, form_a_records, permit_records,
  property_photos, saved_properties, saved_searches, offers, counter_offers,
  transactions, transaction_stage_history, notifications, audit_events
  (+ enums `listing_state`, `offer_state`, `transaction_stage`,
  `verification_status`; FKs, indexes, `updated_at` triggers).
- `20260301000300_marketplace_rls.sql` — `enforce_offer_not_on_own_listing()`
  trigger, enable/force RLS on all tables, the full policy set, grants.
- `20260301000400_storage_buckets.sql` — private `ownership-documents` bucket +
  public `listing-photos` bucket and `storage.objects` RLS policies.
- `20260301000500_realtime_proof.sql` — `realtime_counters` table + RLS + added
  to the `supabase_realtime` publication.

**Drizzle (`packages/db/src/schema.ts`) is the typed mirror**, used for queries
and type inference. `drizzle-kit generate` output goes to `packages/db/drizzle`
for **review only**: a human reads the generated SQL and folds the relevant DDL
into the canonical history. Drizzle-generated migrations are **never applied**
from a second mechanism.

`supabase/seed.sql` runs **after** all migrations and seeds the fictional demo
data (Customer A / Customer B / Admin and Dubai properties/listings/offers/
transactions).

## Consequences

- One source of truth; no dual-apply drift. RLS, triggers, grants, storage, and
  realtime config live alongside table DDL in the same ordered history.
- Schema changes are authored as new timestamped SQL files appended to the
  history (never by editing applied files). `drizzle-kit generate` is a review
  aid, not an apply path.
- `pnpm supabase:reset` rebuilds a database deterministically: migrations in
  order, then seed.
- Reviewers must keep `schema.ts` and the SQL in sync by hand; the generate-then-
  review step is the guardrail that catches divergence.
