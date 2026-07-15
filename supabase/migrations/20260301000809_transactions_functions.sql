-- Week 5 — transaction state engine (SECURITY DEFINER). All consequential writes go
-- through these functions; customers have read-only RLS on the transaction tables.
-- Mirrors the Week-4 offer pattern (enable-RLS + no-force + execute grants).

create sequence if not exists public.transaction_reference_seq;

-- Stage order for progression (INITIATED behaves as the CONFIRMATION stage).
-- Helper: the first stage that still has an open required task, else COMPLETION.
create or replace function public.tx_active_stage(p_transaction uuid)
returns public.transaction_status
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select stage from public.transaction_tasks
       where transaction_id = p_transaction and required and status not in ('COMPLETED_DEMO','SKIPPED')
       order by sequence limit 1),
    'COMPLETION'::public.transaction_status);
$$;

-- Recompute persisted status + next_actor from task state. Never touches terminal or
-- cancellation-pending transactions.
create or replace function public.tx_recompute(p_transaction uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_t public.transactions;
  v_stage public.transaction_status;
  v_started boolean;
  v_has_buyer boolean; v_has_seller boolean; v_has_system boolean;
begin
  select * into v_t from public.transactions where id = p_transaction for update;
  if v_t.status in ('COMPLETED_DEMO','CANCELLED','FAILED','CANCELLATION_PENDING') then
    return;
  end if;
  v_stage := public.tx_active_stage(p_transaction);

  -- Activate the active stage's participant tasks (PENDING -> ACTION_REQUIRED).
  update public.transaction_tasks
    set status = 'ACTION_REQUIRED'
    where transaction_id = p_transaction and stage = v_stage and required and status = 'PENDING';

  -- INITIATED until the first confirmation task in the CONFIRMATION stage completes.
  select exists (
    select 1 from public.transaction_tasks
     where transaction_id = p_transaction and stage = 'CONFIRMATION' and status = 'COMPLETED_DEMO'
  ) into v_started;

  select bool_or(assigned_actor = 'BUYER'), bool_or(assigned_actor = 'SELLER'), bool_or(assigned_actor = 'SYSTEM')
    into v_has_buyer, v_has_seller, v_has_system
    from public.transaction_tasks
    where transaction_id = p_transaction and stage = v_stage
      and required and status not in ('COMPLETED_DEMO','SKIPPED');

  update public.transactions set
    status = case when v_stage = 'CONFIRMATION' and not v_started then 'INITIATED' else v_stage end,
    next_actor = (case
        when coalesce(v_has_buyer,false) and coalesce(v_has_seller,false) then 'BOTH'
        when coalesce(v_has_buyer,false) then 'BUYER'
        when coalesce(v_has_seller,false) then 'SELLER'
        when coalesce(v_has_system,false) then 'SYSTEM'
        else 'NONE' end)::public.transaction_next_actor,
    version = version + 1, updated_at = now()
  where id = p_transaction;
end $$;

-- Idempotent creation from an ACCEPTED offer thread. Returns the (new or existing) row.
create or replace function public.ensure_transaction(p_thread uuid)
returns public.transactions
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_th public.offer_threads;
  v_amount numeric(14,2);
  v_tx public.transactions;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_th from public.offer_threads where id = p_thread;
  if not found or v_uid not in (v_th.buyer_user_id, v_th.seller_user_id) then raise exception 'NOT_FOUND'; end if;

  -- Idempotent: return the existing transaction if present.
  select * into v_tx from public.transactions where offer_thread_id = p_thread;
  if found then return v_tx; end if;

  if v_th.status <> 'ACCEPTED' or v_th.accepted_proposal_id is null then raise exception 'NOT_ACCEPTED'; end if;
  select amount_aed into v_amount from public.offer_proposals where id = v_th.accepted_proposal_id;

  begin
    insert into public.transactions (
      reference, offer_thread_id, accepted_proposal_id, listing_id, buyer_user_id, seller_user_id,
      accepted_amount_aed, status, next_actor, deposit_amount_aed, started_at)
    values (
      'MKZ-TXN-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.transaction_reference_seq')::text, 6, '0'),
      p_thread, v_th.accepted_proposal_id, v_th.listing_id, v_th.buyer_user_id, v_th.seller_user_id,
      v_amount, 'INITIATED', 'BOTH', round(v_amount * 0.10, 2), now())
    returning * into v_tx;
  exception when unique_violation then
    select * into v_tx from public.transactions where offer_thread_id = p_thread;
    return v_tx;
  end;

  -- Persisted milestone tasks (route-independent; financing toggled on route selection).
  insert into public.transaction_tasks (transaction_id, code, stage, sequence, assigned_actor, required, status) values
    (v_tx.id, 'BUYER_CONFIRM_DETAILS',    'CONFIRMATION',  10, 'BUYER',  true,  'ACTION_REQUIRED'),
    (v_tx.id, 'SELLER_CONFIRM_DETAILS',   'CONFIRMATION',  11, 'SELLER', true,  'ACTION_REQUIRED'),
    (v_tx.id, 'BUYER_SELECT_ROUTE',       'CONFIRMATION',  12, 'BUYER',  true,  'ACTION_REQUIRED'),
    (v_tx.id, 'BUYER_CONFIRM_DEPOSIT',    'DEPOSIT',       20, 'BUYER',  true,  'PENDING'),
    (v_tx.id, 'BUYER_DOCUMENTS',          'DOCUMENTS',     30, 'BUYER',  true,  'PENDING'),
    (v_tx.id, 'SELLER_DOCUMENTS',         'DOCUMENTS',     31, 'SELLER', true,  'PENDING'),
    (v_tx.id, 'BUYER_FINANCING',          'DOCUMENTS',     32, 'BUYER',  false, 'PENDING'),
    (v_tx.id, 'BUYER_REVIEW_SUMMARY',     'DOCUMENTS',     33, 'BUYER',  true,  'PENDING'),
    (v_tx.id, 'SELLER_REVIEW_SUMMARY',    'DOCUMENTS',     34, 'SELLER', true,  'PENDING'),
    (v_tx.id, 'DUE_DILIGENCE',            'DUE_DILIGENCE', 40, 'SYSTEM', true,  'PENDING'),
    (v_tx.id, 'SELLER_PROPOSE_DATE',      'TRANSFER',      50, 'SELLER', true,  'PENDING'),
    (v_tx.id, 'BUYER_CONFIRM_READINESS',  'TRANSFER',      51, 'BUYER',  true,  'PENDING'),
    (v_tx.id, 'SELLER_CONFIRM_READINESS', 'TRANSFER',      52, 'SELLER', true,  'PENDING'),
    (v_tx.id, 'TRANSFER_APPOINTMENT',     'TRANSFER',      53, 'SYSTEM', true,  'PENDING'),
    (v_tx.id, 'BUYER_CONFIRM_COMPLETION', 'COMPLETION',    60, 'BUYER',  true,  'PENDING'),
    (v_tx.id, 'SELLER_CONFIRM_COMPLETION','COMPLETION',    61, 'SELLER', true,  'PENDING'),
    (v_tx.id, 'TRANSACTION_COMPLETE',     'COMPLETION',    62, 'SYSTEM', true,  'PENDING');

  insert into public.transaction_events (transaction_id, event_type) values (v_tx.id, 'TRANSACTION_CREATED');
  insert into public.notifications (recipient_id, channel, kind, payload) values
    (v_th.buyer_user_id,  'IN_APP', 'TRANSACTION_CREATED', jsonb_build_object('transactionId', v_tx.id)),
    (v_th.seller_user_id, 'IN_APP', 'TRANSACTION_CREATED', jsonb_build_object('transactionId', v_tx.id));
  insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
    values (v_uid, 'TRANSACTION_CREATED', 'transaction', v_tx.id, '{}'::jsonb);

  select * into v_tx from public.transactions where id = v_tx.id;
  return v_tx;
end $$;

-- Shared guard: lock + validate participant/version, reject terminal. Returns the row.
create or replace function public.tx_lock(p_transaction uuid, p_expected_version int)
returns public.transactions
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_t public.transactions;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_t from public.transactions where id = p_transaction for update;
  if not found or v_uid not in (v_t.buyer_user_id, v_t.seller_user_id) then raise exception 'NOT_FOUND'; end if;
  if v_t.version <> p_expected_version then raise exception 'STALE'; end if;
  if v_t.status in ('COMPLETED_DEMO','CANCELLED','FAILED') then raise exception 'TERMINAL'; end if;
  return v_t;
end $$;

-- Generic completion for simple participant confirmation tasks.
create or replace function public.tx_complete_task(p_transaction uuid, p_code text, p_expected_version int)
returns public.transactions
language plpgsql security definer set search_path = public as $$
declare
  v_t public.transactions; v_side public.transaction_actor; v_task public.transaction_tasks;
  v_allowed text[] := array['BUYER_CONFIRM_DETAILS','SELLER_CONFIRM_DETAILS','BUYER_DOCUMENTS','SELLER_DOCUMENTS',
                            'BUYER_REVIEW_SUMMARY','SELLER_REVIEW_SUMMARY','BUYER_CONFIRM_READINESS','SELLER_CONFIRM_READINESS'];
  v_recipient uuid; v_evt public.transaction_event_type;
begin
  v_t := public.tx_lock(p_transaction, p_expected_version);
  v_side := case when auth.uid() = v_t.buyer_user_id then 'BUYER'::public.transaction_actor else 'SELLER'::public.transaction_actor end;
  if v_t.status = 'CANCELLATION_PENDING' then raise exception 'CANCELLATION_PENDING'; end if;
  if not (p_code = any(v_allowed)) then raise exception 'INVALID_TASK'; end if;

  select * into v_task from public.transaction_tasks where transaction_id = p_transaction and code = p_code for update;
  if not found then raise exception 'INVALID_TASK'; end if;
  if v_task.assigned_actor <> v_side then raise exception 'NOT_YOUR_TASK'; end if;
  if v_task.stage <> public.tx_active_stage(p_transaction) then raise exception 'NOT_ACTIONABLE'; end if;
  if v_task.status = 'COMPLETED_DEMO' then return v_t; end if;   -- idempotent

  update public.transaction_tasks set status = 'COMPLETED_DEMO', completed_at = now(), version = version + 1
    where id = v_task.id;

  v_evt := case
    when p_code like '%CONFIRM_DETAILS' then 'DETAILS_CONFIRMED'
    when p_code like '%REVIEW_SUMMARY'  then 'SUMMARY_REVIEWED'
    when p_code like '%READINESS'       then 'TRANSFER_READINESS_CONFIRMED'
    else 'SUMMARY_REVIEWED' end;
  insert into public.transaction_events (transaction_id, event_type, actor) values (p_transaction, v_evt, v_side);

  v_recipient := case when v_side = 'BUYER' then v_t.seller_user_id else v_t.buyer_user_id end;
  insert into public.notifications (recipient_id, channel, kind, payload)
    values (v_recipient, 'IN_APP', 'TRANSACTION_ACTION_REQUIRED', jsonb_build_object('transactionId', p_transaction));
  insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
    values (auth.uid(), 'TRANSACTION_TASK_COMPLETED', 'transaction', p_transaction, jsonb_build_object('code', p_code));

  perform public.tx_recompute(p_transaction);
  select * into v_t from public.transactions where id = p_transaction;
  return v_t;
end $$;

-- Buyer selects purchase route; toggles the conditional financing task.
create or replace function public.tx_select_route(p_transaction uuid, p_route public.transaction_purchase_route, p_expected_version int)
returns public.transactions
language plpgsql security definer set search_path = public as $$
declare v_t public.transactions; v_side public.transaction_actor;
begin
  v_t := public.tx_lock(p_transaction, p_expected_version);
  v_side := case when auth.uid() = v_t.buyer_user_id then 'BUYER'::public.transaction_actor else 'SELLER'::public.transaction_actor end;
  if v_side <> 'BUYER' then raise exception 'NOT_YOUR_TASK'; end if;
  if v_t.status not in ('INITIATED','CONFIRMATION') then raise exception 'NOT_ACTIONABLE'; end if;
  if v_t.deposit_confirmed_at is not null then raise exception 'ROUTE_LOCKED'; end if;

  update public.transactions set purchase_route = p_route,
    financing_status = case when p_route = 'FINANCING' then 'NOT_STARTED'::public.transaction_financing_status else null end
    where id = p_transaction;
  update public.transaction_tasks set required = (p_route = 'FINANCING'),
    status = (case when p_route = 'FINANCING' then 'ACTION_REQUIRED' else 'SKIPPED' end)::public.transaction_task_status
    where transaction_id = p_transaction and code = 'BUYER_FINANCING';
  update public.transaction_tasks set status = 'COMPLETED_DEMO', completed_at = now(), version = version + 1
    where transaction_id = p_transaction and code = 'BUYER_SELECT_ROUTE' and status <> 'COMPLETED_DEMO';

  insert into public.transaction_events (transaction_id, event_type, actor, metadata)
    values (p_transaction, 'PURCHASE_ROUTE_SELECTED', 'BUYER', jsonb_build_object('route', p_route));
  insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
    values (auth.uid(), 'PURCHASE_ROUTE_SELECTED', 'transaction', p_transaction, jsonb_build_object('route', p_route));
  perform public.tx_recompute(p_transaction);
  select * into v_t from public.transactions where id = p_transaction; return v_t;
end $$;

-- Buyer updates the simulated financing status.
create or replace function public.tx_set_financing(p_transaction uuid, p_status public.transaction_financing_status, p_expected_version int)
returns public.transactions
language plpgsql security definer set search_path = public as $$
declare v_t public.transactions; v_side public.transaction_actor;
begin
  v_t := public.tx_lock(p_transaction, p_expected_version);
  v_side := case when auth.uid() = v_t.buyer_user_id then 'BUYER'::public.transaction_actor else 'SELLER'::public.transaction_actor end;
  if v_side <> 'BUYER' then raise exception 'NOT_YOUR_TASK'; end if;
  if v_t.purchase_route <> 'FINANCING' then raise exception 'NOT_ACTIONABLE'; end if;

  update public.transactions set financing_status = p_status where id = p_transaction;
  update public.transaction_tasks set
      status = (case when p_status = 'CONFIRMED_DEMO' then 'COMPLETED_DEMO'
                    when p_status = 'UNABLE_TO_PROCEED' then 'BLOCKED' else 'ACTION_REQUIRED' end)::public.transaction_task_status,
      completed_at = case when p_status = 'CONFIRMED_DEMO' then now() else null end, version = version + 1
    where transaction_id = p_transaction and code = 'BUYER_FINANCING';
  insert into public.transaction_events (transaction_id, event_type, actor, metadata)
    values (p_transaction, 'FINANCING_STATUS_UPDATED', 'BUYER', jsonb_build_object('status', p_status));
  insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
    values (auth.uid(), 'FINANCING_STATUS_UPDATED', 'transaction', p_transaction, jsonb_build_object('status', p_status));
  perform public.tx_recompute(p_transaction);
  select * into v_t from public.transactions where id = p_transaction; return v_t;
end $$;

-- Buyer confirms the demo deposit (idempotent).
create or replace function public.tx_confirm_deposit(p_transaction uuid, p_expected_version int)
returns public.transactions
language plpgsql security definer set search_path = public as $$
declare v_t public.transactions; v_side public.transaction_actor;
begin
  v_t := public.tx_lock(p_transaction, p_expected_version);
  v_side := case when auth.uid() = v_t.buyer_user_id then 'BUYER'::public.transaction_actor else 'SELLER'::public.transaction_actor end;
  if v_side <> 'BUYER' then raise exception 'NOT_YOUR_TASK'; end if;
  if public.tx_active_stage(p_transaction) <> 'DEPOSIT' then raise exception 'NOT_ACTIONABLE'; end if;
  if v_t.deposit_confirmed_at is not null then return v_t; end if;   -- idempotent

  update public.transactions set deposit_confirmed_at = now() where id = p_transaction;
  update public.transaction_tasks set status = 'COMPLETED_DEMO', completed_at = now(), version = version + 1
    where transaction_id = p_transaction and code = 'BUYER_CONFIRM_DEPOSIT';
  insert into public.transaction_events (transaction_id, event_type, actor, metadata)
    values (p_transaction, 'DEMO_DEPOSIT_CONFIRMED', 'BUYER', jsonb_build_object('amountAed', v_t.deposit_amount_aed));
  insert into public.notifications (recipient_id, channel, kind, payload)
    values (v_t.seller_user_id, 'IN_APP', 'TRANSACTION_DEPOSIT_CONFIRMED_DEMO', jsonb_build_object('transactionId', p_transaction));
  insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
    values (auth.uid(), 'DEMO_DEPOSIT_CONFIRMED', 'transaction', p_transaction, '{}'::jsonb);
  perform public.tx_recompute(p_transaction);
  select * into v_t from public.transactions where id = p_transaction; return v_t;
end $$;

-- SYSTEM: run the simulated due-diligence checks (either participant may trigger).
create or replace function public.tx_run_due_diligence(p_transaction uuid, p_expected_version int)
returns public.transactions
language plpgsql security definer set search_path = public as $$
declare v_t public.transactions; v_side public.transaction_actor;
begin
  v_t := public.tx_lock(p_transaction, p_expected_version);
  v_side := case when auth.uid() = v_t.buyer_user_id then 'BUYER'::public.transaction_actor else 'SELLER'::public.transaction_actor end;
  if public.tx_active_stage(p_transaction) <> 'DUE_DILIGENCE' then raise exception 'NOT_ACTIONABLE'; end if;

  update public.transaction_tasks set status = 'COMPLETED_DEMO', completed_at = now(), version = version + 1
    where transaction_id = p_transaction and code = 'DUE_DILIGENCE' and status <> 'COMPLETED_DEMO';
  insert into public.transaction_events (transaction_id, event_type, actor) values (p_transaction, 'DUE_DILIGENCE_COMPLETED_DEMO', 'SYSTEM');
  insert into public.notifications (recipient_id, channel, kind, payload) values
    (v_t.buyer_user_id,  'IN_APP', 'TRANSACTION_ACTION_REQUIRED', jsonb_build_object('transactionId', p_transaction)),
    (v_t.seller_user_id, 'IN_APP', 'TRANSACTION_ACTION_REQUIRED', jsonb_build_object('transactionId', p_transaction));
  insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
    values (auth.uid(), 'DUE_DILIGENCE_SIMULATION_COMPLETED', 'transaction', p_transaction, '{}'::jsonb);
  perform public.tx_recompute(p_transaction);
  select * into v_t from public.transactions where id = p_transaction; return v_t;
end $$;

-- Seller proposes a preferred transfer date (3-30 days out).
create or replace function public.tx_propose_transfer_date(p_transaction uuid, p_date date, p_expected_version int)
returns public.transactions
language plpgsql security definer set search_path = public as $$
declare v_t public.transactions; v_side public.transaction_actor;
begin
  v_t := public.tx_lock(p_transaction, p_expected_version);
  v_side := case when auth.uid() = v_t.buyer_user_id then 'BUYER'::public.transaction_actor else 'SELLER'::public.transaction_actor end;
  if v_side <> 'SELLER' then raise exception 'NOT_YOUR_TASK'; end if;
  if public.tx_active_stage(p_transaction) <> 'TRANSFER' then raise exception 'NOT_ACTIONABLE'; end if;
  if p_date < (current_date + 3) or p_date > (current_date + 30) then raise exception 'INVALID_DATE'; end if;

  update public.transactions set transfer_preferred_date = p_date where id = p_transaction;
  update public.transaction_tasks set status = 'COMPLETED_DEMO', completed_at = now(), version = version + 1
    where transaction_id = p_transaction and code = 'SELLER_PROPOSE_DATE' and status <> 'COMPLETED_DEMO';
  insert into public.transaction_events (transaction_id, event_type, actor, metadata)
    values (p_transaction, 'TRANSFER_DATE_PROPOSED', 'SELLER', jsonb_build_object('date', p_date));
  insert into public.notifications (recipient_id, channel, kind, payload)
    values (v_t.buyer_user_id, 'IN_APP', 'TRANSACTION_ACTION_REQUIRED', jsonb_build_object('transactionId', p_transaction));
  insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
    values (auth.uid(), 'TRANSFER_DATE_PROPOSED', 'transaction', p_transaction, '{}'::jsonb);
  perform public.tx_recompute(p_transaction);
  select * into v_t from public.transactions where id = p_transaction; return v_t;
end $$;

-- SYSTEM: create the simulated transfer appointment once both readiness tasks are done.
create or replace function public.tx_create_appointment(p_transaction uuid, p_expected_version int)
returns public.transactions
language plpgsql security definer set search_path = public as $$
declare v_t public.transactions; v_side public.transaction_actor; v_ready int;
begin
  v_t := public.tx_lock(p_transaction, p_expected_version);
  v_side := case when auth.uid() = v_t.buyer_user_id then 'BUYER'::public.transaction_actor else 'SELLER'::public.transaction_actor end;
  if public.tx_active_stage(p_transaction) <> 'TRANSFER' then raise exception 'NOT_ACTIONABLE'; end if;
  select count(*) into v_ready from public.transaction_tasks
    where transaction_id = p_transaction and code in ('BUYER_CONFIRM_READINESS','SELLER_CONFIRM_READINESS')
      and status = 'COMPLETED_DEMO';
  if v_ready < 2 then raise exception 'NOT_READY'; end if;
  if v_t.transfer_appointment_at is not null then return v_t; end if;   -- idempotent

  update public.transactions set transfer_appointment_at = now() where id = p_transaction;
  update public.transaction_tasks set status = 'COMPLETED_DEMO', completed_at = now(), version = version + 1
    where transaction_id = p_transaction and code = 'TRANSFER_APPOINTMENT';
  insert into public.transaction_events (transaction_id, event_type, actor) values (p_transaction, 'TRANSFER_APPOINTMENT_SIMULATED', 'SYSTEM');
  insert into public.notifications (recipient_id, channel, kind, payload) values
    (v_t.buyer_user_id,  'IN_APP', 'TRANSACTION_TRANSFER_READY', jsonb_build_object('transactionId', p_transaction)),
    (v_t.seller_user_id, 'IN_APP', 'TRANSACTION_TRANSFER_READY', jsonb_build_object('transactionId', p_transaction));
  insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
    values (auth.uid(), 'TRANSFER_APPOINTMENT_SIMULATED', 'transaction', p_transaction, '{}'::jsonb);
  perform public.tx_recompute(p_transaction);
  select * into v_t from public.transactions where id = p_transaction; return v_t;
end $$;

-- Each participant confirms completion; when both are done, complete atomically.
create or replace function public.tx_confirm_completion(p_transaction uuid, p_expected_version int)
returns public.transactions
language plpgsql security definer set search_path = public as $$
declare v_t public.transactions; v_side public.transaction_actor; v_code text; v_both int; v_open int;
begin
  v_t := public.tx_lock(p_transaction, p_expected_version);
  v_side := case when auth.uid() = v_t.buyer_user_id then 'BUYER'::public.transaction_actor else 'SELLER'::public.transaction_actor end;
  if public.tx_active_stage(p_transaction) <> 'COMPLETION' then raise exception 'NOT_ACTIONABLE'; end if;
  v_code := case when v_side = 'BUYER' then 'BUYER_CONFIRM_COMPLETION' else 'SELLER_CONFIRM_COMPLETION' end;

  update public.transaction_tasks set status = 'COMPLETED_DEMO', completed_at = now(), version = version + 1
    where transaction_id = p_transaction and code = v_code and status <> 'COMPLETED_DEMO';
  insert into public.transaction_events (transaction_id, event_type, actor) values (p_transaction, 'COMPLETION_CONFIRMED', v_side);
  insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
    values (auth.uid(), 'TRANSACTION_COMPLETION_CONFIRMED', 'transaction', p_transaction, '{}'::jsonb);

  select count(*) into v_both from public.transaction_tasks
    where transaction_id = p_transaction and code in ('BUYER_CONFIRM_COMPLETION','SELLER_CONFIRM_COMPLETION')
      and status = 'COMPLETED_DEMO';

  if v_both = 2 then
    -- Final revalidation: every required non-skipped task except the SYSTEM completer is done.
    select count(*) into v_open from public.transaction_tasks
      where transaction_id = p_transaction and required and status not in ('COMPLETED_DEMO','SKIPPED')
        and code <> 'TRANSACTION_COMPLETE';
    if v_open > 0 then raise exception 'NOT_ACTIONABLE'; end if;

    update public.transaction_tasks set status = 'COMPLETED_DEMO', completed_at = now(), version = version + 1
      where transaction_id = p_transaction and code = 'TRANSACTION_COMPLETE';
    update public.transactions set status = 'COMPLETED_DEMO', next_actor = 'NONE', completed_at = now(), version = version + 1
      where id = p_transaction;
    -- Listing becomes SOLD_DEMO (spec §1.1.13) — removed from marketplace, offers blocked.
    update public.listings set state = 'SOLD_DEMO', public_updated_at = now() where id = v_t.listing_id;
    insert into public.transaction_events (transaction_id, event_type, actor) values (p_transaction, 'COMPLETED_DEMO', 'SYSTEM');
    insert into public.notifications (recipient_id, channel, kind, payload) values
      (v_t.buyer_user_id,  'IN_APP', 'TRANSACTION_COMPLETED_DEMO', jsonb_build_object('transactionId', p_transaction)),
      (v_t.seller_user_id, 'IN_APP', 'TRANSACTION_COMPLETED_DEMO', jsonb_build_object('transactionId', p_transaction));
    insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
      values (auth.uid(), 'TRANSACTION_COMPLETED_DEMO', 'transaction', p_transaction, '{}'::jsonb);
  else
    insert into public.notifications (recipient_id, channel, kind, payload)
      values (case when v_side='BUYER' then v_t.seller_user_id else v_t.buyer_user_id end,
              'IN_APP', 'TRANSACTION_ACTION_REQUIRED', jsonb_build_object('transactionId', p_transaction));
    perform public.tx_recompute(p_transaction);
  end if;
  select * into v_t from public.transactions where id = p_transaction; return v_t;
end $$;

-- Request cancellation. Unilateral (immediate) while INITIATED/CONFIRMATION before both
-- details confirmed; otherwise mutual (CANCELLATION_PENDING until the other confirms).
create or replace function public.tx_request_cancellation(p_transaction uuid, p_reason text, p_expected_version int)
returns public.transactions
language plpgsql security definer set search_path = public as $$
declare v_t public.transactions; v_side public.transaction_actor; v_details int; v_other uuid; v_unilateral boolean;
begin
  v_t := public.tx_lock(p_transaction, p_expected_version);
  v_side := case when auth.uid() = v_t.buyer_user_id then 'BUYER'::public.transaction_actor else 'SELLER'::public.transaction_actor end;
  if v_t.status = 'CANCELLATION_PENDING' then raise exception 'ALREADY_PENDING'; end if;
  select count(*) into v_details from public.transaction_tasks
    where transaction_id = p_transaction and code in ('BUYER_CONFIRM_DETAILS','SELLER_CONFIRM_DETAILS') and status = 'COMPLETED_DEMO';
  v_unilateral := v_t.status in ('INITIATED','CONFIRMATION') and v_details < 2;
  v_other := case when v_side = 'BUYER' then v_t.seller_user_id else v_t.buyer_user_id end;

  if v_unilateral then
    perform public.tx_finalize_cancellation(p_transaction, p_reason, v_side);
  else
    update public.transactions set status = 'CANCELLATION_PENDING',
      next_actor = (case when v_side='BUYER' then 'SELLER' else 'BUYER' end)::public.transaction_next_actor,
      cancellation_requested_by = auth.uid(), cancellation_reason = p_reason, version = version + 1 where id = p_transaction;
    insert into public.transaction_events (transaction_id, event_type, actor, metadata)
      values (p_transaction, 'CANCELLATION_REQUESTED', v_side, jsonb_build_object('reason', p_reason));
    insert into public.notifications (recipient_id, channel, kind, payload)
      values (v_other, 'IN_APP', 'TRANSACTION_CANCELLATION_REQUESTED', jsonb_build_object('transactionId', p_transaction));
    insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
      values (auth.uid(), 'TRANSACTION_CANCELLATION_REQUESTED', 'transaction', p_transaction, jsonb_build_object('reason', p_reason));
  end if;
  select * into v_t from public.transactions where id = p_transaction; return v_t;
end $$;

-- Shared finalizer: CANCELLED + listing PAUSED (never auto-LIVE; spec §1.1.14).
create or replace function public.tx_finalize_cancellation(p_transaction uuid, p_reason text, p_side public.transaction_actor)
returns void language plpgsql security definer set search_path = public as $$
declare v_t public.transactions;
begin
  select * into v_t from public.transactions where id = p_transaction for update;
  update public.transactions set status = 'CANCELLED', next_actor = 'NONE', cancelled_at = now(),
    cancellation_reason = coalesce(cancellation_reason, p_reason), version = version + 1 where id = p_transaction;
  -- Listing is PAUSED, not returned to LIVE; the seller must review/resume later.
  update public.listings set state = 'PAUSED', paused_at = now() where id = v_t.listing_id and state = 'LIVE';
  insert into public.transaction_events (transaction_id, event_type, actor) values (p_transaction, 'CANCELLED', p_side);
  insert into public.notifications (recipient_id, channel, kind, payload) values
    (v_t.buyer_user_id,  'IN_APP', 'TRANSACTION_CANCELLED', jsonb_build_object('transactionId', p_transaction)),
    (v_t.seller_user_id, 'IN_APP', 'TRANSACTION_CANCELLED', jsonb_build_object('transactionId', p_transaction));
  insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
    values (auth.uid(), 'TRANSACTION_CANCELLED', 'transaction', p_transaction, '{}'::jsonb);
end $$;

-- The OTHER participant confirms or declines a pending cancellation.
create or replace function public.tx_resolve_cancellation(p_transaction uuid, p_confirm boolean, p_expected_version int)
returns public.transactions
language plpgsql security definer set search_path = public as $$
declare v_t public.transactions; v_side public.transaction_actor;
begin
  v_t := public.tx_lock(p_transaction, p_expected_version);
  v_side := case when auth.uid() = v_t.buyer_user_id then 'BUYER'::public.transaction_actor else 'SELLER'::public.transaction_actor end;
  if v_t.status <> 'CANCELLATION_PENDING' then raise exception 'NOT_ACTIONABLE'; end if;
  if v_t.cancellation_requested_by = auth.uid() then raise exception 'NOT_YOUR_TASK'; end if;

  if p_confirm then
    perform public.tx_finalize_cancellation(p_transaction, v_t.cancellation_reason, v_side);
  else
    update public.transactions set status = public.tx_active_stage(p_transaction),
      cancellation_requested_by = null, cancellation_reason = null, version = version + 1 where id = p_transaction;
    insert into public.transaction_events (transaction_id, event_type, actor) values (p_transaction, 'CANCELLATION_DECLINED', v_side);
    insert into public.notifications (recipient_id, channel, kind, payload)
      values (case when v_side='BUYER' then v_t.seller_user_id else v_t.buyer_user_id end,
              'IN_APP', 'TRANSACTION_ACTION_REQUIRED', jsonb_build_object('transactionId', p_transaction));
    insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
      values (auth.uid(), 'TRANSACTION_CANCELLATION_RESOLVED', 'transaction', p_transaction, jsonb_build_object('declined', true));
    perform public.tx_recompute(p_transaction);
  end if;
  select * into v_t from public.transactions where id = p_transaction; return v_t;
end $$;

-- Extend the Week-4 UNDER_OFFER derivation to ignore cancelled transactions (spec §31):
-- a resumed listing whose transaction was cancelled must not still read as under offer.
create or replace function public.listing_has_accepted_offer(p_listing uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.offer_threads th
    where th.listing_id = p_listing and th.status = 'ACCEPTED'
      and not exists (
        select 1 from public.transactions t
        where t.offer_thread_id = th.id and t.status = 'CANCELLED'));
$$;

-- ---------------------------------------------------------------------------
-- RLS: keep enabled but NOT forced, so these owner-run SECURITY DEFINER functions
-- can write (hosted Supabase postgres owner is not BYPASSRLS) — mirrors ...0805.
-- ---------------------------------------------------------------------------
alter table public.transactions no force row level security;
alter table public.transaction_tasks no force row level security;
alter table public.transaction_documents no force row level security;
alter table public.transaction_events no force row level security;

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
  public.tx_resolve_cancellation(uuid, boolean, int)
  to authenticated, service_role;
