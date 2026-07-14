-- Week 4 fix (forward-only): authoritative "is this listing under offer?" check.
--
-- The `offers.eligibility` tRPC query resolved UNDER_OFFER by reading `offer_threads`
-- for an ACCEPTED row under the CALLER's RLS context. But an accepted thread is private
-- to its two participants, so a NON-participant buyer cannot see it — eligibility then
-- wrongly reported the listing as available and rendered the offer form. (The actual
-- submission was still blocked by the SECURITY DEFINER `create_offer`, which raises
-- UNDER_OFFER, so this was a UX/correctness defect, not an exploit.)
--
-- This helper answers the question authoritatively regardless of the caller's RLS —
-- "under offer" is public-facing status (the marketplace shows it), while the specific
-- thread/amount/buyer stay private.

create or replace function public.listing_has_accepted_offer(p_listing uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.offer_threads
    where listing_id = p_listing and status = 'ACCEPTED'
  );
$$;

grant execute on function public.listing_has_accepted_offer(uuid) to authenticated, anon;
