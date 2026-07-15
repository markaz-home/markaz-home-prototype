-- Week 6 fix: return-a-publication-for-changes must run as a SECURITY DEFINER function,
-- like every other admin action. The tRPC procedure previously inserted the owner's
-- notification directly through the admin's RLS-bound connection, which RLS blocks
-- (a user may only insert their OWN notifications) — rolling the whole action back.
-- Caught by the Week-6 admin E2E. This mirrors admin_pause_listing et al.
create or replace function public.admin_return_publication(p_request uuid, p_reason text)
returns public.listing_publication_requests
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_req public.listing_publication_requests; v_owner uuid;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  select * into v_req from public.listing_publication_requests where id = p_request for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v_req.status <> 'PENDING' then raise exception 'STALE'; end if;

  update public.listing_publication_requests
     set status = 'REJECTED_DEMO', outcome_category = p_reason, resolved_at = now()
   where id = p_request
   returning * into v_req;

  insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  values (v_uid, 'ADMIN_PUBLICATION_RETURNED_FOR_CHANGES', 'listing', v_req.listing_id,
          jsonb_build_object('reason', p_reason, 'result', 'REJECTED_DEMO'));

  select owner_id into v_owner from public.listings where id = v_req.listing_id;
  if v_owner is not null then
    insert into public.notifications (recipient_id, channel, kind, payload)
    values (v_owner, 'IN_APP', 'PUBLICATION_RETURNED', jsonb_build_object('listingId', v_req.listing_id));
  end if;

  return v_req;
end $$;

revoke all on function public.admin_return_publication(uuid, text) from public, anon, authenticated;
grant execute on function public.admin_return_publication(uuid, text) to authenticated;
