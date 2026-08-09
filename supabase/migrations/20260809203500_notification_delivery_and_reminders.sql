-- Offer/transaction communication foundation.
--
-- In-app notifications remain the canonical customer activity record. Email is
-- derived into a durable private outbox in the SAME transaction, then delivered
-- asynchronously by the trusted web cron worker. No external network request is
-- ever made while an offer/transaction state transition is holding DB locks.

alter table public.notifications add column if not exists dedupe_key text;
create unique index if not exists notifications_dedupe_key_idx
  on public.notifications (dedupe_key) where dedupe_key is not null;

create table if not exists private.notification_email_outbox (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  status text not null default 'PENDING'
    check (status in ('PENDING','SENDING','SENT','FAILED','SKIPPED_NO_EMAIL')),
  attempts int not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  sent_at timestamptz,
  provider_message_id text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists notification_email_outbox_notification_key
  on private.notification_email_outbox (notification_id);
create index if not exists notification_email_outbox_pending_idx
  on private.notification_email_outbox (status, available_at, created_at);

drop trigger if exists notification_email_outbox_set_updated_at
  on private.notification_email_outbox;
create trigger notification_email_outbox_set_updated_at
  before update on private.notification_email_outbox
  for each row execute function public.set_updated_at();

revoke all on private.notification_email_outbox from public, anon, authenticated;

-- Add stable property/amount references to every new offer or transaction
-- notification. The API still projects a strict allow-list; this context exists
-- so rich notification cards and email jobs describe the exact event rather than
-- whichever proposal happens to be current when they are rendered later.
create or replace function private.enrich_notification_context()
returns trigger language plpgsql security definer set search_path = public, private as $$
declare
  v_thread uuid;
  v_transaction uuid;
  v_listing uuid;
  v_amount numeric(14,2);
begin
  if new.payload ? 'threadId' then
    begin
      v_thread := (new.payload->>'threadId')::uuid;
      select th.listing_id, p.amount_aed into v_listing, v_amount
        from public.offer_threads th
        left join public.offer_proposals p on p.id = th.current_proposal_id
        where th.id = v_thread;
      if v_listing is not null then
        new.payload := new.payload || jsonb_build_object('listingId', v_listing);
      end if;
      if v_amount is not null then
        new.payload := new.payload || jsonb_build_object('amountAed', v_amount);
      end if;
    exception when invalid_text_representation then null;
    end;
  elsif new.payload ? 'transactionId' then
    begin
      v_transaction := (new.payload->>'transactionId')::uuid;
      select t.listing_id, t.accepted_amount_aed into v_listing, v_amount
        from public.transactions t where t.id = v_transaction;
      if v_listing is not null then
        new.payload := new.payload || jsonb_build_object(
          'listingId', v_listing,
          'amountAed', v_amount
        );
      end if;
    exception when invalid_text_representation then null;
    end;
  end if;
  return new;
end $$;

drop trigger if exists enrich_notification_context on public.notifications;
create trigger enrich_notification_context
  before insert on public.notifications
  for each row execute function private.enrich_notification_context();

-- Only meaningful customer events become email. View receipts intentionally stay
-- in-app so normal browsing cannot create email noise.
create or replace function private.enqueue_notification_email()
returns trigger language plpgsql security definer set search_path = public, private as $$
begin
  if new.channel = 'IN_APP' and new.kind = any(array[
    'OFFER_RECEIVED',
    'OFFER_COUNTER_SELLER',
    'OFFER_COUNTER_BUYER',
    'OFFER_REJECTED',
    'OFFER_WITHDRAWN',
    'OFFER_CLOSED_OTHER',
    'OFFER_LISTING_UNAVAILABLE',
    'OFFER_EXPIRED',
    -- TRANSACTION_CREATED is the accepted-offer email for BOTH participants.
    'TRANSACTION_CREATED',
    'TRANSACTION_ACTION_REQUIRED',
    'TRANSACTION_REMINDER',
    'TRANSACTION_DEPOSIT_CONFIRMED_DEMO',
    'TRANSACTION_TRANSFER_READY',
    'TRANSACTION_COMPLETED_DEMO',
    'TRANSACTION_CANCELLATION_REQUESTED',
    'TRANSACTION_CANCELLED',
    'TRANSACTION_FAILED',
    'TRANSACTION_MARKED_FAILED'
  ]) then
    insert into private.notification_email_outbox
      (notification_id, recipient_id, kind)
    values (new.id, new.recipient_id, new.kind)
    on conflict (notification_id) do nothing;
  end if;
  return new;
end $$;

drop trigger if exists enqueue_notification_email on public.notifications;
create trigger enqueue_notification_email
  after insert on public.notifications
  for each row execute function private.enqueue_notification_email();

-- The legacy threshold suppressed the seller notification entirely. Preserve the
-- threshold classification in the seller UI, but create the promised notification
-- and email for below-threshold offers too. At/above-threshold offers continue down
-- the original create_offer path, so no duplicate row is created.
create or replace function private.notify_below_threshold_offer()
returns trigger language plpgsql security definer set search_path = public, private as $$
declare v_t public.offer_threads;
begin
  if new.event_type <> 'OFFER_SUBMITTED' then return new; end if;
  select * into v_t from public.offer_threads where id = new.thread_id;
  if found and public.offer_below_threshold(v_t.listing_id, new.amount_aed) then
    insert into public.notifications (recipient_id, channel, kind, payload)
    values (
      v_t.seller_user_id,
      'IN_APP',
      'OFFER_RECEIVED',
      jsonb_build_object('threadId', v_t.id, 'listingId', v_t.listing_id, 'amountAed', new.amount_aed)
    );
  end if;
  return new;
end $$;

drop trigger if exists notify_below_threshold_offer on public.offer_events;
create trigger notify_below_threshold_offer
  after insert on public.offer_events
  for each row execute function private.notify_below_threshold_offer();

-- One view receipt per buyer-authored proposal. Reopening or refreshing the same
-- proposal is idempotent; a later buyer counteroffer can receive its own receipt.
create or replace function public.mark_offer_viewed(p_thread uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_t public.offer_threads;
  v_amount numeric(14,2);
begin
  -- Serialise simultaneous opens from multiple tabs so the existence check and
  -- insert below remain exactly-once without exposing a customer-writeable key.
  select * into v_t from public.offer_threads where id = p_thread for update;
  if not found or v_uid <> v_t.seller_user_id or v_t.current_proposal_id is null then return; end if;

  -- Only acknowledge proposals authored by the buyer. A seller must not receive a
  -- self-view receipt after opening their own counteroffer.
  select amount_aed into v_amount from public.offer_proposals
    where id = v_t.current_proposal_id and created_by_side = 'BUYER';
  if not found then return; end if;

  if not exists (
    select 1 from public.offer_events
      where thread_id = p_thread
        and event_type = 'OFFER_VIEWED'
        and metadata->>'proposalId' = v_t.current_proposal_id::text
  ) then
    insert into public.offer_events (thread_id, event_type, actor_side, amount_aed, metadata)
    values (
      p_thread,
      'OFFER_VIEWED',
      'SELLER',
      v_amount,
      jsonb_build_object('proposalId', v_t.current_proposal_id)
    );
    insert into public.notifications (recipient_id, channel, kind, payload)
    values (
      v_t.buyer_user_id,
      'IN_APP',
      'OFFER_VIEWED',
      jsonb_build_object('threadId', p_thread, 'listingId', v_t.listing_id, 'amountAed', v_amount)
    );
  end if;
end $$;

-- Acceptance itself creates the shared workspace. This DB-level handoff means
-- continuity does not depend on either participant finding or clicking a button,
-- and it also covers trusted callers outside the current tRPC route.
create or replace function private.ensure_transaction_after_offer_accept()
returns trigger language plpgsql security definer set search_path = public, private as $$
begin
  if new.event_type = 'OFFER_ACCEPTED' then
    perform public.ensure_transaction(new.thread_id);
  end if;
  return new;
end $$;

drop trigger if exists ensure_transaction_after_offer_accept on public.offer_events;
create trigger ensure_transaction_after_offer_accept
  after insert on public.offer_events
  for each row execute function private.ensure_transaction_after_offer_accept();

-- Queue one reminder for a particular transaction version after it has waited for
-- the same participant(s) for 24h. Completing any action increments the version,
-- giving the next waiting state its own idempotency key.
create or replace function private.queue_due_transaction_reminders(p_after_hours int default 24)
returns integer language plpgsql security definer set search_path = public, private as $$
declare v_count int;
begin
  if p_after_hours < 1 or p_after_hours > 168 then raise exception 'INVALID_REMINDER_WINDOW'; end if;

  with due as (
    select
      t.*,
      recipient.id as recipient_id
    from public.transactions t
    cross join lateral (
      select t.buyer_user_id as id where t.next_actor in ('BUYER','BOTH')
      union all
      select t.seller_user_id as id where t.next_actor in ('SELLER','BOTH')
    ) recipient
    where t.status not in ('COMPLETED_DEMO','CANCELLED','FAILED','CANCELLATION_PENDING')
      and t.updated_at <= now() - make_interval(hours => p_after_hours)
  ), inserted as (
    insert into public.notifications (recipient_id, channel, kind, payload, dedupe_key)
    select
      d.recipient_id,
      'IN_APP',
      'TRANSACTION_REMINDER',
      jsonb_build_object(
        'transactionId', d.id,
        'listingId', d.listing_id,
        'amountAed', d.accepted_amount_aed,
        'stage', d.status,
        'waitingFor', d.next_actor
      ),
      'transaction-reminder:' || d.id::text || ':' || d.version::text || ':' || d.recipient_id::text
    from due d
    on conflict (dedupe_key) where dedupe_key is not null do nothing
    returning 1
  )
  select count(*)::int into v_count from inserted;
  return coalesce(v_count, 0);
end $$;

revoke all on function private.queue_due_transaction_reminders(int)
  from public, anon, authenticated;
revoke all on function private.enrich_notification_context()
  from public, anon, authenticated;
revoke all on function private.enqueue_notification_email()
  from public, anon, authenticated;
revoke all on function private.notify_below_threshold_offer()
  from public, anon, authenticated;
revoke all on function private.ensure_transaction_after_offer_accept()
  from public, anon, authenticated;

-- Header notifications become fresh through the same participant-scoped Realtime
-- connection model used by offer/transaction timelines.
do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null; end $$;
