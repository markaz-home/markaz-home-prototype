-- =============================================================================
-- MARKAZ Home — migration 08.5: offer RLS works on hosted Supabase
-- Forward-only fix. The Week-4 offer write path is "customers read-only via RLS;
-- all writes go through SECURITY DEFINER functions owned by the table owner".
-- On a LOCAL stack the owner is a superuser, so `force row level security` was a
-- harmless belt-and-braces. On HOSTED Supabase the `postgres` owner is NOT a
-- superuser/BYPASSRLS, so FORCE incorrectly subjects the elevated functions to
-- RLS — and because the offer tables (and notifications, written for OTHER users)
-- have no permissive INSERT policy, every offer write is denied.
--
-- Keep RLS ENABLED (the app always runs customer queries as the `authenticated`/
-- `anon` role, which is never the table owner, so RLS still restricts customers to
-- read-only). Drop FORCE so the table-owner SECURITY DEFINER functions can write.
-- =============================================================================

alter table public.offer_threads   no force row level security;
alter table public.offer_proposals no force row level security;
alter table public.offer_events    no force row level security;

-- The offer functions also write in-app notifications to the OTHER participant; the
-- generic notifications table is written ONLY by server functions (no customer
-- INSERT path), so dropping FORCE here is safe and keeps recipient-only reads.
alter table public.notifications   no force row level security;
