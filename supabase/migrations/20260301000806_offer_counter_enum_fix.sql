-- Week 4 fix (forward-only): the counter-offer path was non-functional.
--
-- In `submit_counter`, three columns were assigned from a bare CASE expression whose
-- result type resolves to `text`. Postgres has no implicit assignment cast from `text`
-- to an enum, so `UPDATE offer_threads SET status = case ... end` (and next_actor, and
-- the offer_events.event_type INSERT) raised at runtime:
--   column "status" is of type offer_thread_status but expression is of type text
-- The bug only surfaces when the function actually executes past its guard checks
-- (i.e. a real counter), so it slipped through unit/component tests and was never run
-- against a live database. Every buyer/seller counter was broken. This re-creates the
-- function verbatim except the three CASE results are cast to their enum types.
--
-- Also drops the orphaned `enforce_offer_not_on_own_listing()` left behind when the
-- Week-1 flat `offers` table (and its trigger) were dropped in migration ...0804.

create or replace function public.submit_counter(
  p_thread uuid, p_amount numeric, p_expires_at timestamptz, p_expected_version int)
returns public.offer_threads
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_t public.offer_threads; v_side public.offer_side; v_recipient uuid;
  v_cur public.offer_proposals; v_new uuid;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
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
end $$;

-- Orphaned dead code from the retired Week-1 flat offer model (table + trigger dropped in ...0804).
drop function if exists public.enforce_offer_not_on_own_listing() cascade;
