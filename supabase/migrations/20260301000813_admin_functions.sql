-- Week 6 — restriction/pause enforcement folded into the existing customer functions,
-- then the Admin SECURITY DEFINER functions (ADR-0024/0026/0028). Every admin function
-- re-checks is_admin() (belt over the adminProcedure tier).

-- patched: create_offer
CREATE OR REPLACE FUNCTION public.create_offer(p_listing uuid, p_amount numeric, p_expires_at timestamp with time zone)
 RETURNS offer_threads
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_owner uuid; v_state public.listing_state; v_lv int; v_pv int; v_seq int;
  v_thread public.offer_threads; v_proposal uuid;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if public.is_restricted(v_uid) then raise exception 'ACCOUNT_RESTRICTED'; end if;
  select owner_id, state, version, publication_version
    into v_owner, v_state, v_lv, v_pv
    from public.listings where id = p_listing for update;
  if v_owner is null then raise exception 'LISTING_NOT_FOUND'; end if;
  if v_owner = v_uid then raise exception 'OWN_LISTING'; end if;
  if v_state <> 'LIVE' then raise exception 'LISTING_UNAVAILABLE'; end if;
  if p_amount is null or p_amount <= 0 or p_amount > 999999999 then raise exception 'INVALID_AMOUNT'; end if;
  if exists (select 1 from public.offer_threads where listing_id = p_listing and status = 'ACCEPTED') then
    raise exception 'UNDER_OFFER';
  end if;

  select coalesce(max(buyer_seq), 0) + 1 into v_seq
    from public.offer_threads where listing_id = p_listing;

  insert into public.offer_threads (
    listing_id, buyer_user_id, seller_user_id, status, next_actor,
    expires_at, buyer_seq, listing_version, publication_version, last_activity_at)
  values (p_listing, v_uid, v_owner, 'AWAITING_SELLER', 'SELLER',
    p_expires_at, v_seq, v_lv, v_pv, now())
  returning * into v_thread;

  insert into public.offer_proposals (thread_id, created_by_user_id, created_by_side, amount_aed, status, expires_at)
  values (v_thread.id, v_uid, 'BUYER', p_amount, 'CURRENT', p_expires_at)
  returning id into v_proposal;

  update public.offer_threads set current_proposal_id = v_proposal where id = v_thread.id
  returning * into v_thread;

  insert into public.offer_events (thread_id, event_type, actor_side, amount_aed)
  values (v_thread.id, 'OFFER_SUBMITTED', 'BUYER', p_amount);

  insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  values (v_uid, 'OFFER_THREAD_CREATED', 'offer_thread', v_thread.id,
          jsonb_build_object('listingId', p_listing)),
         (v_uid, 'OFFER_PROPOSAL_SUBMITTED', 'offer_thread', v_thread.id,
          jsonb_build_object('side', 'BUYER'));

  -- Seller notification only when at/above threshold (§27.1).
  if not public.offer_below_threshold(p_listing, p_amount) then
    insert into public.notifications (recipient_id, channel, kind, payload)
    values (v_owner, 'IN_APP', 'OFFER_RECEIVED', jsonb_build_object('threadId', v_thread.id, 'listingId', p_listing));
    insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
    values (v_uid, 'OFFER_NOTIFICATION_CREATED', 'offer_thread', v_thread.id, jsonb_build_object('kind', 'OFFER_RECEIVED'));
  end if;

  return v_thread;
end $function$
;


-- patched: submit_counter
CREATE OR REPLACE FUNCTION public.submit_counter(p_thread uuid, p_amount numeric, p_expires_at timestamp with time zone, p_expected_version integer)
 RETURNS offer_threads
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_t public.offer_threads; v_side public.offer_side; v_recipient uuid;
  v_cur public.offer_proposals; v_new uuid;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if public.is_restricted(v_uid) then raise exception 'ACCOUNT_RESTRICTED'; end if;
  select * into v_t from public.offer_threads where id = p_thread for update;
  if not found or v_uid not in (v_t.buyer_user_id, v_t.seller_user_id) then raise exception 'NOT_FOUND'; end if;
  if v_t.version <> p_expected_version then raise exception 'STALE'; end if;
  if v_t.status not in ('AWAITING_BUYER','AWAITING_SELLER') then raise exception 'NOT_ACTIONABLE'; end if;

  if v_uid = v_t.buyer_user_id then v_side := 'BUYER'; else v_side := 'SELLER'; end if;
  if v_t.next_actor::text <> v_side::text then raise exception 'NOT_YOUR_TURN'; end if;

  perform public.assert_offer_actionable(v_t.listing_id, v_t.listing_version, v_t.publication_version, v_t.id);

  select * into v_cur from public.offer_proposals where id = v_t.current_proposal_id;
  if v_cur.expires_at is not null and v_cur.expires_at <= now() then raise exception 'EXPIRED'; end if;
  if p_amount is null or p_amount <= 0 or p_amount > 999999999 then raise exception 'INVALID_AMOUNT'; end if;
  if p_amount = v_cur.amount_aed then raise exception 'EQUAL_AMOUNT'; end if;

  update public.offer_proposals set status = 'SUPERSEDED' where id = v_t.current_proposal_id;
  insert into public.offer_proposals (thread_id, created_by_user_id, created_by_side, amount_aed, status, expires_at)
  values (p_thread, v_uid, v_side, p_amount, 'CURRENT', p_expires_at)
  returning id into v_new;

  update public.offer_threads set
    current_proposal_id = v_new,
    status     = (case when v_side = 'BUYER' then 'AWAITING_SELLER' else 'AWAITING_BUYER' end)::public.offer_thread_status,
    next_actor = (case when v_side = 'BUYER' then 'SELLER' else 'BUYER' end)::public.offer_next_actor,
    expires_at = p_expires_at, version = version + 1, last_activity_at = now()
  where id = p_thread returning * into v_t;

  insert into public.offer_events (thread_id, event_type, actor_side, amount_aed)
  values (p_thread,
          (case when v_side = 'BUYER' then 'BUYER_COUNTERED' else 'SELLER_COUNTERED' end)::public.offer_event_type,
          v_side, p_amount);

  v_recipient := case when v_side = 'BUYER' then v_t.seller_user_id else v_t.buyer_user_id end;
  insert into public.notifications (recipient_id, channel, kind, payload)
  values (v_recipient, 'IN_APP', case when v_side = 'BUYER' then 'OFFER_COUNTER_BUYER' else 'OFFER_COUNTER_SELLER' end,
          jsonb_build_object('threadId', p_thread));
  insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  values (v_uid, case when v_side = 'BUYER' then 'OFFER_COUNTERED_BY_BUYER' else 'OFFER_COUNTERED_BY_SELLER' end,
          'offer_thread', p_thread, '{}'::jsonb);

  return v_t;
end $function$
;


-- patched: accept_offer
CREATE OR REPLACE FUNCTION public.accept_offer(p_thread uuid, p_proposal uuid, p_expected_version integer)
 RETURNS offer_threads
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_t public.offer_threads; v_side public.offer_side; v_cur public.offer_proposals;
  v_recipient uuid; v_other public.offer_threads;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if public.is_restricted(v_uid) then raise exception 'ACCOUNT_RESTRICTED'; end if;
  select * into v_t from public.offer_threads where id = p_thread for update;
  if not found or v_uid not in (v_t.buyer_user_id, v_t.seller_user_id) then raise exception 'NOT_FOUND'; end if;
  -- Lock the listing to serialise concurrent acceptances on the same property.
  perform 1 from public.listings where id = v_t.listing_id for update;
  if v_t.version <> p_expected_version then raise exception 'STALE'; end if;
  if v_t.status not in ('AWAITING_BUYER','AWAITING_SELLER') then raise exception 'NOT_ACTIONABLE'; end if;

  if v_uid = v_t.buyer_user_id then v_side := 'BUYER'; else v_side := 'SELLER'; end if;
  if v_t.next_actor::text <> v_side::text then raise exception 'NOT_YOUR_TURN'; end if;
  if v_t.current_proposal_id is distinct from p_proposal then raise exception 'STALE'; end if;

  perform public.assert_offer_actionable(v_t.listing_id, v_t.listing_version, v_t.publication_version, v_t.id);

  select * into v_cur from public.offer_proposals where id = p_proposal;
  if v_cur.expires_at is not null and v_cur.expires_at <= now() then raise exception 'EXPIRED'; end if;
  if exists (select 1 from public.offer_threads where listing_id = v_t.listing_id and status = 'ACCEPTED') then
    raise exception 'ALREADY_ACCEPTED';
  end if;

  update public.offer_proposals set status = 'ACCEPTED' where id = p_proposal;
  update public.offer_threads set
    status = 'ACCEPTED', next_actor = 'NONE', accepted_proposal_id = p_proposal,
    version = version + 1, last_activity_at = now()
  where id = p_thread returning * into v_t;

  insert into public.offer_events (thread_id, event_type, actor_side, amount_aed)
  values (p_thread, 'OFFER_ACCEPTED', v_side, v_cur.amount_aed);

  -- Close every other active thread for this listing (§6.2 / §27.3).
  for v_other in
    select * from public.offer_threads
    where listing_id = v_t.listing_id and id <> p_thread
      and status in ('DRAFT','AWAITING_SELLER','AWAITING_BUYER')
  loop
    update public.offer_proposals set status = 'CLOSED'
      where thread_id = v_other.id and status in ('CURRENT','SUPERSEDED');
    update public.offer_threads set
      status = 'CLOSED_OTHER_ACCEPTED', next_actor = 'NONE',
      closed_reason = 'OTHER_ACCEPTED', version = version + 1, last_activity_at = now()
    where id = v_other.id;
    insert into public.offer_events (thread_id, event_type) values (v_other.id, 'OTHER_OFFER_ACCEPTED');
    insert into public.notifications (recipient_id, channel, kind, payload)
    values (v_other.buyer_user_id, 'IN_APP', 'OFFER_CLOSED_OTHER', jsonb_build_object('threadId', v_other.id));
    insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
    values (v_uid, 'OFFER_CLOSED_OTHER_ACCEPTED', 'offer_thread', v_other.id, '{}'::jsonb);
  end loop;

  -- Notify the other participant of the acceptance.
  v_recipient := case when v_side = 'BUYER' then v_t.seller_user_id else v_t.buyer_user_id end;
  insert into public.notifications (recipient_id, channel, kind, payload)
  values (v_recipient, 'IN_APP', 'OFFER_ACCEPTED', jsonb_build_object('threadId', p_thread));
  insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  values (v_uid, 'OFFER_ACCEPTED', 'offer_thread', p_thread, jsonb_build_object('side', v_side));

  return v_t;
end $function$
;


-- patched: reject_offer
CREATE OR REPLACE FUNCTION public.reject_offer(p_thread uuid, p_expected_version integer, p_reason text)
 RETURNS offer_threads
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid(); v_t public.offer_threads; v_side public.offer_side; v_recipient uuid;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if public.is_restricted(v_uid) then raise exception 'ACCOUNT_RESTRICTED'; end if;
  select * into v_t from public.offer_threads where id = p_thread for update;
  if not found or v_uid not in (v_t.buyer_user_id, v_t.seller_user_id) then raise exception 'NOT_FOUND'; end if;
  if v_t.version <> p_expected_version then raise exception 'STALE'; end if;
  if v_t.status not in ('AWAITING_BUYER','AWAITING_SELLER') then raise exception 'NOT_ACTIONABLE'; end if;
  if v_uid = v_t.buyer_user_id then v_side := 'BUYER'; else v_side := 'SELLER'; end if;
  if v_t.next_actor::text <> v_side::text then raise exception 'NOT_YOUR_TURN'; end if;

  update public.offer_proposals set status = 'REJECTED' where id = v_t.current_proposal_id;
  update public.offer_threads set
    status = 'REJECTED', next_actor = 'NONE', closed_reason = 'REJECTED',
    reject_reason_code = case when v_side = 'SELLER' then p_reason else null end,
    version = version + 1, last_activity_at = now()
  where id = p_thread returning * into v_t;

  insert into public.offer_events (thread_id, event_type, actor_side) values (p_thread, 'OFFER_REJECTED', v_side);
  v_recipient := case when v_side = 'BUYER' then v_t.seller_user_id else v_t.buyer_user_id end;
  insert into public.notifications (recipient_id, channel, kind, payload)
  values (v_recipient, 'IN_APP', 'OFFER_REJECTED', jsonb_build_object('threadId', p_thread));
  insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  values (v_uid, 'OFFER_REJECTED', 'offer_thread', p_thread, '{}'::jsonb);

  return v_t;
end $function$
;


-- patched: withdraw_offer
CREATE OR REPLACE FUNCTION public.withdraw_offer(p_thread uuid, p_expected_version integer)
 RETURNS offer_threads
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_uid uuid := auth.uid(); v_t public.offer_threads;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if public.is_restricted(v_uid) then raise exception 'ACCOUNT_RESTRICTED'; end if;
  select * into v_t from public.offer_threads where id = p_thread for update;
  if not found or v_uid not in (v_t.buyer_user_id, v_t.seller_user_id) then raise exception 'NOT_FOUND'; end if;
  if v_uid <> v_t.buyer_user_id then raise exception 'NOT_YOUR_TURN'; end if;
  if v_t.version <> p_expected_version then raise exception 'STALE'; end if;
  if v_t.status not in ('AWAITING_BUYER','AWAITING_SELLER') then raise exception 'NOT_ACTIONABLE'; end if;

  update public.offer_proposals set status = 'WITHDRAWN' where id = v_t.current_proposal_id;
  update public.offer_threads set
    status = 'WITHDRAWN', next_actor = 'NONE', closed_reason = 'WITHDRAWN',
    version = version + 1, last_activity_at = now()
  where id = p_thread returning * into v_t;

  insert into public.offer_events (thread_id, event_type, actor_side) values (p_thread, 'OFFER_WITHDRAWN', 'BUYER');
  insert into public.notifications (recipient_id, channel, kind, payload)
  values (v_t.seller_user_id, 'IN_APP', 'OFFER_WITHDRAWN', jsonb_build_object('threadId', p_thread));
  insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  values (v_uid, 'OFFER_WITHDRAWN', 'offer_thread', p_thread, '{}'::jsonb);

  return v_t;
end $function$
;


-- patched: tx_lock
CREATE OR REPLACE FUNCTION public.tx_lock(p_transaction uuid, p_expected_version integer)
 RETURNS transactions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_uid uuid := auth.uid(); v_t public.transactions;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_t from public.transactions where id = p_transaction for update;
  if not found or v_uid not in (v_t.buyer_user_id, v_t.seller_user_id) then raise exception 'NOT_FOUND'; end if;
  if v_t.version <> p_expected_version then raise exception 'STALE'; end if;
  if v_t.status in ('COMPLETED_DEMO','CANCELLED','FAILED') then raise exception 'TERMINAL'; end if;
  if v_t.progression_paused_at is not null then raise exception 'PROGRESSION_PAUSED'; end if;
  return v_t;
end $function$
;


-- ===========================================================================
-- Admin SECURITY DEFINER functions. All check is_admin(); all write an audit event.
-- ===========================================================================

-- Append-only admin note (spec §16).
create or replace function public.admin_add_note(
  p_entity_type text, p_entity_id uuid, p_category public.admin_note_category,
  p_body text, p_follow_up date, p_supersedes uuid)
returns public.admin_notes
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_note public.admin_notes;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if char_length(p_body) < 3 or char_length(p_body) > 1000 then raise exception 'INVALID_BODY'; end if;
  insert into public.admin_notes (entity_type, entity_id, category, body, follow_up_date, created_by_admin_id, supersedes_note_id)
  values (p_entity_type, p_entity_id, p_category, p_body, p_follow_up, v_uid, p_supersedes)
  returning * into v_note;
  insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  values (v_uid, 'ADMIN_NOTE_ADDED', p_entity_type, p_entity_id, jsonb_build_object('category', p_category));
  return v_note;
end $$;

-- Restrict / restore customer actions (spec §15). Does not touch identity or public listings.
create or replace function public.admin_restrict_customer(p_customer uuid, p_reason text)
returns public.profiles
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_p public.profiles;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  select * into v_p from public.profiles where id = p_customer for update;
  if not found or v_p.account_type <> 'CUSTOMER' then raise exception 'NOT_FOUND'; end if;
  if v_p.restricted_at is not null then raise exception 'ALREADY_RESTRICTED'; end if;
  update public.profiles set restricted_at = now(), restriction_reason = p_reason, restricted_by = v_uid
    where id = p_customer returning * into v_p;
  insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  values (v_uid, 'ADMIN_CUSTOMER_ACTIONS_RESTRICTED', 'customer', p_customer,
          jsonb_build_object('reason', p_reason, 'previous', 'ACTIVE', 'result', 'ACTIONS_RESTRICTED'));
  insert into public.notifications (recipient_id, channel, kind, payload)
  values (p_customer, 'IN_APP', 'ACCOUNT_ACTIONS_RESTRICTED', '{}'::jsonb);
  return v_p;
end $$;

create or replace function public.admin_restore_customer(p_customer uuid, p_reason text)
returns public.profiles
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_p public.profiles;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  select * into v_p from public.profiles where id = p_customer for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v_p.restricted_at is null then raise exception 'NOT_RESTRICTED'; end if;
  update public.profiles set restricted_at = null, restriction_reason = null, restricted_by = null
    where id = p_customer returning * into v_p;
  insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  values (v_uid, 'ADMIN_CUSTOMER_ACTIONS_RESTORED', 'customer', p_customer,
          jsonb_build_object('reason', p_reason, 'previous', 'ACTIONS_RESTRICTED', 'result', 'ACTIVE'));
  insert into public.notifications (recipient_id, channel, kind, payload)
  values (p_customer, 'IN_APP', 'ACCOUNT_ACTIONS_RESTORED', '{}'::jsonb);
  return v_p;
end $$;

-- Admin pause / resume a listing (spec §21). Pause closes active offer threads (§21 rules).
create or replace function public.admin_pause_listing(p_listing uuid, p_reason text)
returns public.listings
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_l public.listings;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  select * into v_l from public.listings where id = p_listing for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v_l.state <> 'LIVE' then raise exception 'NOT_LIVE'; end if;
  update public.listings set state = 'PAUSED', paused_at = now() where id = p_listing returning * into v_l;
  perform public.close_listing_offers(p_listing, 'LISTING_PAUSED');
  insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  values (v_uid, 'ADMIN_LISTING_PAUSED', 'listing', p_listing,
          jsonb_build_object('reason', p_reason, 'previous', 'LIVE', 'result', 'PAUSED'));
  insert into public.notifications (recipient_id, channel, kind, payload)
  values (v_l.owner_id, 'IN_APP', 'LISTING_PAUSED_BY_ADMIN', jsonb_build_object('listingId', p_listing));
  return v_l;
end $$;

create or replace function public.admin_resume_listing(p_listing uuid, p_reason text)
returns public.listings
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_l public.listings;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  select * into v_l from public.listings where id = p_listing for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v_l.state <> 'PAUSED' then raise exception 'NOT_PAUSED'; end if;
  if v_l.public_id is null then raise exception 'NOT_ELIGIBLE'; end if;
  -- Cannot resume a listing whose transaction completed (SOLD_DEMO) — guarded by state check above.
  update public.listings set state = 'LIVE', paused_at = null, public_updated_at = now() where id = p_listing returning * into v_l;
  insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  values (v_uid, 'ADMIN_LISTING_RESUMED', 'listing', p_listing,
          jsonb_build_object('reason', p_reason, 'previous', 'PAUSED', 'result', 'LIVE'));
  insert into public.notifications (recipient_id, channel, kind, payload)
  values (v_l.owner_id, 'IN_APP', 'LISTING_RESUMED_BY_ADMIN', jsonb_build_object('listingId', p_listing));
  return v_l;
end $$;

-- Operational close of an invalid offer thread (spec §25.3). Never mutates proposals.
create or replace function public.admin_close_offer_thread(p_thread uuid, p_reason text)
returns public.offer_threads
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_t public.offer_threads;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  select * into v_t from public.offer_threads where id = p_thread for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v_t.status not in ('DRAFT','AWAITING_SELLER','AWAITING_BUYER') then raise exception 'NOT_ACTIONABLE'; end if;
  update public.offer_proposals set status = 'CLOSED' where thread_id = p_thread and status in ('CURRENT','SUPERSEDED');
  update public.offer_threads set status = 'CLOSED_LISTING_UNAVAILABLE', next_actor = 'NONE',
    closed_reason = 'ADMIN_CLOSED', version = version + 1, last_activity_at = now()
    where id = p_thread returning * into v_t;
  insert into public.offer_events (thread_id, event_type) values (p_thread, 'LISTING_UNAVAILABLE');
  insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  values (v_uid, 'ADMIN_OFFER_THREAD_CLOSED', 'offer_thread', p_thread, jsonb_build_object('reason', p_reason));
  return v_t;
end $$;

-- Transaction recovery (spec §28). Admin never confirms customer tasks or changes identity/amount.
create or replace function public.admin_pause_transaction(p_transaction uuid, p_reason text)
returns public.transactions
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_t public.transactions;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  select * into v_t from public.transactions where id = p_transaction for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v_t.status in ('COMPLETED_DEMO','CANCELLED','FAILED') then raise exception 'TERMINAL'; end if;
  if v_t.progression_paused_at is not null then raise exception 'ALREADY_PAUSED'; end if;
  update public.transactions set progression_paused_at = now(), progression_pause_reason = p_reason, version = version + 1
    where id = p_transaction returning * into v_t;
  insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  values (v_uid, 'ADMIN_TRANSACTION_PAUSED', 'transaction', p_transaction, jsonb_build_object('reason', p_reason));
  return v_t;
end $$;

create or replace function public.admin_resume_transaction(p_transaction uuid, p_reason text)
returns public.transactions
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_t public.transactions;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  select * into v_t from public.transactions where id = p_transaction for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v_t.progression_paused_at is null then raise exception 'NOT_PAUSED'; end if;
  update public.transactions set progression_paused_at = null, progression_pause_reason = null, version = version + 1
    where id = p_transaction returning * into v_t;
  insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  values (v_uid, 'ADMIN_TRANSACTION_RESUMED', 'transaction', p_transaction, jsonb_build_object('reason', p_reason));
  return v_t;
end $$;

create or replace function public.admin_mark_transaction_failed(p_transaction uuid, p_reason text, p_category text)
returns public.transactions
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_t public.transactions;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  select * into v_t from public.transactions where id = p_transaction for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v_t.status in ('COMPLETED_DEMO','CANCELLED','FAILED') then raise exception 'TERMINAL'; end if;
  update public.transactions set status = 'FAILED', next_actor = 'NONE', failure_category = p_category, version = version + 1
    where id = p_transaction returning * into v_t;
  insert into public.transaction_events (transaction_id, event_type, actor) values (p_transaction, 'FAILED', 'SYSTEM');
  insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  values (v_uid, 'ADMIN_TRANSACTION_MARKED_FAILED', 'transaction', p_transaction, jsonb_build_object('reason', p_reason, 'category', p_category));
  insert into public.notifications (recipient_id, channel, kind, payload) values
    (v_t.buyer_user_id, 'IN_APP', 'TRANSACTION_MARKED_FAILED', jsonb_build_object('transactionId', p_transaction)),
    (v_t.seller_user_id, 'IN_APP', 'TRANSACTION_MARKED_FAILED', jsonb_build_object('transactionId', p_transaction));
  return v_t;
end $$;

-- Retry a failed/blocked SYSTEM task (spec §28.1): re-arm it; never touches customer tasks.
create or replace function public.admin_retry_transaction_step(p_transaction uuid, p_code text, p_reason text)
returns public.transactions
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_t public.transactions; v_task public.transaction_tasks;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  select * into v_t from public.transactions where id = p_transaction for update;
  if not found or v_t.status in ('COMPLETED_DEMO','CANCELLED','FAILED') then raise exception 'NOT_FOUND'; end if;
  select * into v_task from public.transaction_tasks where transaction_id = p_transaction and code = p_code for update;
  if not found or v_task.assigned_actor <> 'SYSTEM' then raise exception 'INVALID_TASK'; end if;
  if v_task.status not in ('FAILED','BLOCKED') then raise exception 'NOT_RETRYABLE'; end if;
  update public.transaction_tasks set status = 'ACTION_REQUIRED', failure_category = null, version = version + 1 where id = v_task.id;
  insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  values (v_uid, 'ADMIN_TRANSACTION_STEP_RETRY_REQUESTED', 'transaction', p_transaction, jsonb_build_object('code', p_code, 'reason', p_reason));
  perform public.tx_recompute(p_transaction);
  select * into v_t from public.transactions where id = p_transaction; return v_t;
end $$;

-- Resolve a stuck cancellation (spec §28.5): only from persisted state; never invents consent.
create or replace function public.admin_resolve_cancellation(p_transaction uuid, p_action text, p_reason text)
returns public.transactions
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_t public.transactions;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  select * into v_t from public.transactions where id = p_transaction for update;
  if not found or v_t.status <> 'CANCELLATION_PENDING' then raise exception 'NOT_ACTIONABLE'; end if;
  if p_action = 'CONFIRM' then
    perform public.tx_finalize_cancellation(p_transaction, v_t.cancellation_reason, 'SYSTEM');
  elsif p_action = 'DECLINE' then
    update public.transactions set status = public.tx_active_stage(p_transaction),
      cancellation_requested_by = null, cancellation_reason = null, version = version + 1 where id = p_transaction;
    perform public.tx_recompute(p_transaction);
  elsif p_action = 'FAIL' then
    update public.transactions set status = 'FAILED', next_actor = 'NONE', failure_category = 'CANCELLATION_CONFLICT', version = version + 1 where id = p_transaction;
  else raise exception 'INVALID_ACTION'; end if;
  insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  values (v_uid, 'ADMIN_CANCELLATION_CONFLICT_RESOLVED', 'transaction', p_transaction, jsonb_build_object('action', p_action, 'reason', p_reason));
  select * into v_t from public.transactions where id = p_transaction; return v_t;
end $$;

-- Retry a failed simulation (spec §22.5): records the retry intent; never overwrites prior result.
create or replace function public.admin_retry_verification(p_verification uuid, p_reason text)
returns public.verifications
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_v public.verifications;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  select * into v_v from public.verifications where id = p_verification for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v_v.status <> 'FAILED_DEMO' then raise exception 'NOT_RETRYABLE'; end if;
  update public.verifications set status = 'PENDING', failure_reason = null, updated_at = now() where id = p_verification returning * into v_v;
  insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  values (v_uid, 'ADMIN_VERIFICATION_RETRY_REQUESTED', 'verification', p_verification, jsonb_build_object('reason', p_reason));
  return v_v;
end $$;

-- Record a private-document access event (spec §23). The signed URL is minted app-side after this.
create or replace function public.admin_record_document_access(p_entity_type text, p_entity_id uuid, p_document_type text, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  values (v_uid, 'ADMIN_PRIVATE_DOCUMENT_ACCESSED', p_entity_type, p_entity_id,
          jsonb_build_object('documentType', p_document_type, 'reason', p_reason));
end $$;

grant execute on function
  public.admin_add_note(text, uuid, public.admin_note_category, text, date, uuid),
  public.admin_restrict_customer(uuid, text), public.admin_restore_customer(uuid, text),
  public.admin_pause_listing(uuid, text), public.admin_resume_listing(uuid, text),
  public.admin_close_offer_thread(uuid, text),
  public.admin_pause_transaction(uuid, text), public.admin_resume_transaction(uuid, text),
  public.admin_mark_transaction_failed(uuid, text, text),
  public.admin_retry_transaction_step(uuid, text, text),
  public.admin_resolve_cancellation(uuid, text, text),
  public.admin_retry_verification(uuid, text),
  public.admin_record_document_access(text, uuid, text, text)
  to authenticated, service_role;
