-- =============================================================================
-- MARKAZ Home — security-boundary hardening
--
-- 1. PostgreSQL grants EXECUTE on new functions to PUBLIC by default. Remove that
--    implicit RPC surface and grant only the reviewed entry points.
-- 2. Customer-facing tables remain readable under RLS, but workflow mutations
--    must originate from the MARKAZ API transaction context. This prevents a
--    Supabase REST client from forging listing/publication/identity/audit state.
-- 3. Keep the seller's offer-notification threshold private from buyer RPCs.
-- =============================================================================

-- The API sets this transaction-local marker only after it has verified the
-- Supabase session and before it drops to the authenticated role. PostgREST
-- clients cannot set arbitrary database GUCs.
-- `current_setting(..., true)` returns NULL when the marker is absent.

-- --- Profiles ---------------------------------------------------------------
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update
  using (
    id = auth.uid()
    and coalesce(current_setting('markaz.trusted_api', true), '') = 'true'
  )
  with check (
    id = auth.uid()
    and account_type = 'CUSTOMER'
    and coalesce(current_setting('markaz.trusted_api', true), '') = 'true'
  );

-- Profiles are created exclusively by the auth.users trigger. There is no
-- customer-facing reason to permit a direct profile INSERT.
drop policy if exists profiles_insert_self on public.profiles;

-- --- Properties -------------------------------------------------------------
drop policy if exists properties_owner_all on public.properties;
drop policy if exists properties_owner_select on public.properties;
drop policy if exists properties_owner_insert on public.properties;
drop policy if exists properties_owner_update on public.properties;
drop policy if exists properties_owner_delete on public.properties;
create policy properties_owner_select on public.properties
  for select using (owner_id = auth.uid());
create policy properties_owner_insert on public.properties
  for insert with check (
    owner_id = auth.uid()
    and coalesce(current_setting('markaz.trusted_api', true), '') = 'true'
  );
create policy properties_owner_update on public.properties
  for update
  using (
    owner_id = auth.uid()
    and coalesce(current_setting('markaz.trusted_api', true), '') = 'true'
  )
  with check (
    owner_id = auth.uid()
    and coalesce(current_setting('markaz.trusted_api', true), '') = 'true'
  );
create policy properties_owner_delete on public.properties
  for delete using (
    owner_id = auth.uid()
    and coalesce(current_setting('markaz.trusted_api', true), '') = 'true'
  );

-- --- Listings ---------------------------------------------------------------
drop policy if exists listings_owner_all on public.listings;
drop policy if exists listings_owner_select on public.listings;
drop policy if exists listings_owner_insert on public.listings;
drop policy if exists listings_owner_update on public.listings;
drop policy if exists listings_owner_delete on public.listings;
create policy listings_owner_select on public.listings
  for select using (owner_id = auth.uid());
create policy listings_owner_insert on public.listings
  for insert with check (
    owner_id = auth.uid()
    and coalesce(current_setting('markaz.trusted_api', true), '') = 'true'
  );
create policy listings_owner_update on public.listings
  for update
  using (
    owner_id = auth.uid()
    and coalesce(current_setting('markaz.trusted_api', true), '') = 'true'
  )
  with check (
    owner_id = auth.uid()
    and coalesce(current_setting('markaz.trusted_api', true), '') = 'true'
  );
create policy listings_owner_delete on public.listings
  for delete using (
    owner_id = auth.uid()
    and coalesce(current_setting('markaz.trusted_api', true), '') = 'true'
  );

-- --- Ownership and listing-operational records ------------------------------
drop policy if exists ownership_docs_owner on public.ownership_documents;
drop policy if exists ownership_docs_owner_select on public.ownership_documents;
drop policy if exists ownership_docs_owner_mutate on public.ownership_documents;
create policy ownership_docs_owner_select on public.ownership_documents
  for select using (owner_id = auth.uid());
create policy ownership_docs_owner_mutate on public.ownership_documents
  for all
  using (
    owner_id = auth.uid()
    and coalesce(current_setting('markaz.trusted_api', true), '') = 'true'
  )
  with check (
    owner_id = auth.uid()
    and coalesce(current_setting('markaz.trusted_api', true), '') = 'true'
  );

do $$
declare
  t text;
begin
  foreach t in array array[
    'verifications', 'form_a_records', 'permit_records', 'property_photos'
  ] loop
    execute format('drop policy if exists %1$I_owner on public.%1$I;', t);
    execute format('drop policy if exists %1$I_owner_select on public.%1$I;', t);
    execute format('drop policy if exists %1$I_owner_mutate on public.%1$I;', t);
    execute format($policy$
      create policy %1$I_owner_select on public.%1$I
        for select using (
          exists (
            select 1 from public.listings l
            where l.id = %1$I.listing_id and l.owner_id = auth.uid()
          )
        );
      create policy %1$I_owner_mutate on public.%1$I
        for all
        using (
          coalesce(current_setting('markaz.trusted_api', true), '') = 'true'
          and exists (
            select 1 from public.listings l
            where l.id = %1$I.listing_id and l.owner_id = auth.uid()
          )
        )
        with check (
          coalesce(current_setting('markaz.trusted_api', true), '') = 'true'
          and exists (
            select 1 from public.listings l
            where l.id = %1$I.listing_id and l.owner_id = auth.uid()
          )
        );
    $policy$, t);
  end loop;
end;
$$;

drop policy if exists investment_cases_owner on public.investment_cases;
drop policy if exists investment_cases_owner_select on public.investment_cases;
drop policy if exists investment_cases_owner_mutate on public.investment_cases;
create policy investment_cases_owner_select on public.investment_cases
  for select using (
    exists (
      select 1 from public.listings l
      where l.id = investment_cases.listing_id and l.owner_id = auth.uid()
    )
  );
create policy investment_cases_owner_mutate on public.investment_cases
  for all
  using (
    coalesce(current_setting('markaz.trusted_api', true), '') = 'true'
    and exists (
      select 1 from public.listings l
      where l.id = investment_cases.listing_id and l.owner_id = auth.uid()
    )
  )
  with check (
    coalesce(current_setting('markaz.trusted_api', true), '') = 'true'
    and exists (
      select 1 from public.listings l
      where l.id = investment_cases.listing_id and l.owner_id = auth.uid()
    )
  );

drop policy if exists publication_requests_owner on public.listing_publication_requests;
drop policy if exists publication_requests_owner_select on public.listing_publication_requests;
drop policy if exists publication_requests_owner_mutate on public.listing_publication_requests;
create policy publication_requests_owner_select on public.listing_publication_requests
  for select using (seller_user_id = auth.uid());
create policy publication_requests_owner_mutate on public.listing_publication_requests
  for all
  using (
    seller_user_id = auth.uid()
    and coalesce(current_setting('markaz.trusted_api', true), '') = 'true'
  )
  with check (
    seller_user_id = auth.uid()
    and coalesce(current_setting('markaz.trusted_api', true), '') = 'true'
  );

-- Audit rows are server-derived. A browser-authenticated customer cannot insert
-- a record merely by choosing an action name and payload.
drop policy if exists audit_insert on public.audit_events;
create policy audit_insert on public.audit_events
  for insert with check (
    (actor_id = auth.uid() or public.is_admin())
    and coalesce(current_setting('markaz.trusted_api', true), '') = 'true'
  );

-- Recipients may acknowledge a notification, but cannot rewrite its type,
-- recipient, or payload.
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

-- --- Close-offers internal workflow guard ----------------------------------
-- This helper is called by the trusted listing API and by checked admin
-- functions. A customer must not be able to call it directly over RPC.
create or replace function public.close_listing_offers(p_listing uuid, p_reason text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_t public.offer_threads;
  v_n int := 0;
  v_evt public.offer_event_type;
begin
  if coalesce(current_setting('markaz.trusted_api', true), '') <> 'true'
     and not public.is_admin()
  then
    raise exception 'TRUSTED_API_REQUIRED' using errcode = 'insufficient_privilege';
  end if;
  if not public.is_admin()
     and not exists (
       select 1 from public.listings l
       where l.id = p_listing and l.owner_id = v_uid
     )
  then
    raise exception 'NOT_FOUND';
  end if;

  v_evt := case
    when p_reason = 'LISTING_PAUSED' then 'LISTING_PAUSED'
    else 'LISTING_UNAVAILABLE'
  end;
  for v_t in
    select *
    from public.offer_threads
    where listing_id = p_listing
      and status in ('DRAFT', 'AWAITING_SELLER', 'AWAITING_BUYER')
  loop
    update public.offer_proposals
    set status = 'CLOSED'
    where thread_id = v_t.id and status in ('CURRENT', 'SUPERSEDED');

    update public.offer_threads
    set status = 'CLOSED_LISTING_UNAVAILABLE',
        next_actor = 'NONE',
        closed_reason = p_reason,
        version = version + 1,
        last_activity_at = now()
    where id = v_t.id;

    insert into public.offer_events (thread_id, event_type, metadata)
    values (v_t.id, v_evt, jsonb_build_object('reason', p_reason));
    insert into public.notifications (recipient_id, channel, kind, payload)
    values (
      v_t.buyer_user_id,
      'IN_APP',
      'OFFER_LISTING_UNAVAILABLE',
      jsonb_build_object('threadId', v_t.id)
    );
    insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
    values (
      v_uid,
      'OFFER_CLOSED_LISTING_UNAVAILABLE',
      'offer_thread',
      v_t.id,
      jsonb_build_object('reason', p_reason)
    );
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

-- A thread participant may load the public-safe summary, but the private seller
-- threshold is returned only to the listing owner.
create or replace function public.offer_listing_summary(p_listing uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_json jsonb;
begin
  if v_uid is null then return null; end if;
  if not exists (
    select 1 from public.listings l
    where l.id = p_listing and l.owner_id = v_uid
  ) and not exists (
    select 1 from public.offer_threads th
    where th.listing_id = p_listing
      and (th.buyer_user_id = v_uid or th.seller_user_id = v_uid)
  ) then
    return null;
  end if;

  select jsonb_build_object(
    'listingId', l.id,
    'ownerId', l.owner_id,
    'state', l.state,
    'version', l.version,
    'publicationVersion', l.publication_version,
    'publicId', l.public_id,
    'publicSlug', l.public_slug,
    'askingPrice', l.asking_price,
    'minNotificationPrice',
      case when l.owner_id = v_uid then l.min_notification_price else null end,
    'bedrooms', p.bedrooms,
    'bathrooms', p.bathrooms,
    'propertyType', p.property_type,
    'community', p.community,
    'buildingOrProject', p.building_or_project,
    'emirate', p.emirate,
    'coverPublicPath', (
      select pp.public_path
      from public.property_photos pp
      where pp.listing_id = l.id
        and pp.is_cover
        and pp.public_path is not null
      limit 1
    )
  )
  into v_json
  from public.listings l
  left join public.properties p on p.id = l.property_id
  where l.id = p_listing;

  return v_json;
end;
$$;

-- --- Function ACL allow-list -----------------------------------------------
-- Reset the public API surface after all prior migrations, including functions
-- that were never explicitly granted (and therefore inherited PUBLIC execute).
revoke all privileges on all functions in schema public from public, anon, authenticated;

-- Predicates used by RLS/public projections.
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.permit_verification(text) to anon, authenticated;
grant execute on function public.listing_has_accepted_offer(uuid) to authenticated;

-- Authenticated customer offer entry points.
grant execute on function
  public.create_offer(uuid, numeric, timestamptz),
  public.submit_counter(uuid, numeric, timestamptz, int),
  public.accept_offer(uuid, uuid, int),
  public.reject_offer(uuid, int, text),
  public.withdraw_offer(uuid, int),
  public.close_listing_offers(uuid, text),
  public.expire_due_offers(),
  public.mark_offer_viewed(uuid),
  public.offer_listing_summary(uuid)
  to authenticated;

-- Authenticated customer transaction entry points. Internal helpers
-- tx_active_stage/tx_recompute/tx_lock/tx_finalize_cancellation stay private.
grant execute on function
  public.ensure_transaction(uuid),
  public.tx_complete_task(uuid, text, int),
  public.tx_select_route(uuid, public.transaction_purchase_route, int),
  public.tx_set_financing(uuid, public.transaction_financing_status, int),
  public.tx_confirm_deposit(uuid, int),
  public.tx_run_due_diligence(uuid, int),
  public.tx_propose_transfer_date(uuid, date, int),
  public.tx_create_appointment(uuid, int),
  public.tx_confirm_completion(uuid, int),
  public.tx_request_cancellation(uuid, text, int),
  public.tx_resolve_cancellation(uuid, boolean, int),
  public.tx_register_document(uuid, text, text, text, text, int),
  public.tx_remove_document(uuid, uuid)
  to authenticated;

-- Admin entry points still perform their own is_admin()/capability checks.
grant execute on function
  public.admin_add_note(text, uuid, public.admin_note_category, text, date, uuid),
  public.admin_restrict_customer(uuid, text),
  public.admin_restore_customer(uuid, text),
  public.admin_pause_listing(uuid, text),
  public.admin_resume_listing(uuid, text),
  public.admin_close_offer_thread(uuid, text),
  public.admin_pause_transaction(uuid, text),
  public.admin_resume_transaction(uuid, text),
  public.admin_mark_transaction_failed(uuid, text, text),
  public.admin_retry_transaction_step(uuid, text, text),
  public.admin_resolve_cancellation(uuid, text, text),
  public.admin_retry_verification(uuid, text),
  public.admin_record_document_access(text, uuid, text, text, text),
  public.admin_return_publication(uuid, text)
  to authenticated;

grant execute on function public.sync_uae_pass_staging_identity() to authenticated;
