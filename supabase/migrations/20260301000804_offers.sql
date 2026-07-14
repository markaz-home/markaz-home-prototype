-- =============================================================================
-- MARKAZ Home — canonical migration 08.4: Week 4 offers + negotiation threads
-- Forward-only. Replaces the Week-1 flat `offers`/`counter_offers` stub with the
-- approved thread + immutable-proposal negotiation model (offers-design-spec §4–6,
-- ADR-0014). RLS is the security boundary: customers may only READ threads they
-- participate in; ALL writes go through SECURITY DEFINER functions that re-validate
-- ownership, eligibility, turn order, expiry, staleness, and the single-accepted-
-- offer rule atomically. Anonymous users have no access. (offers-design-spec §37)
-- =============================================================================

-- --- 0. Retire the obsolete Week-1 offer scaffolding --------------------------
-- Nothing but the seed + one admin metric touched these. The single-offer shape
-- cannot represent a thread with next-actor + immutable counter history (§4).
alter table if exists public.transactions drop constraint if exists transactions_offer_id_fkey;
drop table if exists public.counter_offers cascade;
drop table if exists public.offers cascade;
drop type  if exists public.offer_state;

-- --- 1. Enums ----------------------------------------------------------------
do $$ begin
  create type public.offer_thread_status as enum (
    'DRAFT','AWAITING_SELLER','AWAITING_BUYER','ACCEPTED','REJECTED',
    'WITHDRAWN','EXPIRED','CLOSED_OTHER_ACCEPTED','CLOSED_LISTING_UNAVAILABLE');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.offer_next_actor as enum ('BUYER','SELLER','NONE');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.offer_proposal_status as enum (
    'CURRENT','SUPERSEDED','ACCEPTED','REJECTED','EXPIRED','WITHDRAWN','CLOSED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.offer_side as enum ('BUYER','SELLER');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.offer_event_type as enum (
    'OFFER_SUBMITTED','SELLER_COUNTERED','BUYER_COUNTERED','OFFER_ACCEPTED',
    'OFFER_REJECTED','OFFER_WITHDRAWN','OFFER_EXPIRED','OFFER_VIEWED',
    'LISTING_PAUSED','LISTING_UNAVAILABLE','OTHER_OFFER_ACCEPTED');
exception when duplicate_object then null; end $$;

-- --- 2. Tables ---------------------------------------------------------------
create table if not exists public.offer_threads (
  id                   uuid primary key default gen_random_uuid(),
  listing_id           uuid not null references public.listings (id) on delete cascade,
  buyer_user_id        uuid not null references public.profiles (id) on delete cascade,
  seller_user_id       uuid not null references public.profiles (id) on delete cascade,
  status               public.offer_thread_status not null default 'DRAFT',
  next_actor           public.offer_next_actor not null default 'BUYER',
  current_proposal_id  uuid,
  accepted_proposal_id uuid,
  closed_reason        text,
  -- Seller-private predefined reason; NEVER projected to the buyer (§23.3).
  reject_reason_code   text,
  -- Mirrors the current proposal's expiry for cheap list rendering (§25).
  expires_at           timestamptz,
  -- Stable per-listing buyer sequence backing the "Buyer NN" safe label (§17.4).
  buyer_seq            integer not null default 1,
  -- Snapshots so a material listing edit invalidates stale negotiations (§28.3).
  listing_version      integer not null default 1,
  publication_version  integer not null default 1,
  version              integer not null default 1,
  last_activity_at     timestamptz not null default now(),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint offer_threads_buyer_ne_seller check (buyer_user_id <> seller_user_id)
);
create index if not exists offer_threads_buyer_idx    on public.offer_threads (buyer_user_id);
create index if not exists offer_threads_seller_idx   on public.offer_threads (seller_user_id);
create index if not exists offer_threads_listing_idx  on public.offer_threads (listing_id);
create index if not exists offer_threads_status_idx   on public.offer_threads (status);
create index if not exists offer_threads_activity_idx on public.offer_threads (last_activity_at);

-- One non-closed thread per (buyer, listing) — the one-thread rule (§4.2).
create unique index if not exists uniq_active_thread_per_buyer_listing
  on public.offer_threads (listing_id, buyer_user_id)
  where status in ('DRAFT','AWAITING_SELLER','AWAITING_BUYER');

-- At most one accepted offer per listing — DB-enforced single acceptance (§6.2).
create unique index if not exists uniq_accepted_thread_per_listing
  on public.offer_threads (listing_id)
  where status = 'ACCEPTED';

create table if not exists public.offer_proposals (
  id                  uuid primary key default gen_random_uuid(),
  thread_id           uuid not null references public.offer_threads (id) on delete cascade,
  created_by_user_id  uuid not null references public.profiles (id) on delete cascade,
  created_by_side     public.offer_side not null,
  amount_aed          numeric(14,2) not null,
  status              public.offer_proposal_status not null default 'CURRENT',
  expires_at          timestamptz,
  created_at          timestamptz not null default now(),
  constraint offer_proposals_amount_valid check (amount_aed > 0 and amount_aed <= 999999999)
);
create index if not exists offer_proposals_thread_idx on public.offer_proposals (thread_id);

-- Participant-readable negotiation timeline (distinct from private audit_events).
create table if not exists public.offer_events (
  id          uuid primary key default gen_random_uuid(),
  thread_id   uuid not null references public.offer_threads (id) on delete cascade,
  event_type  public.offer_event_type not null,
  actor_side  public.offer_side,
  amount_aed  numeric(14,2),
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists offer_events_thread_idx on public.offer_events (thread_id, created_at);

-- Same-thread integrity for the current / accepted proposal pointers.
alter table public.offer_threads
  drop constraint if exists offer_threads_current_proposal_fk,
  add  constraint offer_threads_current_proposal_fk
       foreign key (current_proposal_id) references public.offer_proposals (id) on delete set null;
alter table public.offer_threads
  drop constraint if exists offer_threads_accepted_proposal_fk,
  add  constraint offer_threads_accepted_proposal_fk
       foreign key (accepted_proposal_id) references public.offer_proposals (id) on delete set null;

-- updated_at trigger (shared helper from migration 01).
drop trigger if exists offer_threads_set_updated_at on public.offer_threads;
create trigger offer_threads_set_updated_at before update on public.offer_threads
  for each row execute function public.set_updated_at();

-- --- 3. Immutability guard ----------------------------------------------------
-- Identity / money columns are immutable for ordinary roles; ACCEPTED status and
-- accepted_proposal_id may be written ONLY by the elevated acceptance function
-- (current_user = function owner, not 'authenticated'/'anon').
create or replace function public.guard_offer_thread()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' then
    if new.listing_id      is distinct from old.listing_id
       or new.buyer_user_id  is distinct from old.buyer_user_id
       or new.seller_user_id is distinct from old.seller_user_id then
      raise exception 'offer thread identity is immutable' using errcode = 'check_violation';
    end if;
    if current_user in ('authenticated','anon')
       and (new.status = 'ACCEPTED' or new.accepted_proposal_id is distinct from old.accepted_proposal_id) then
      raise exception 'offer acceptance is performed only by the server' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists guard_offer_thread on public.offer_threads;
create trigger guard_offer_thread before update on public.offer_threads
  for each row execute function public.guard_offer_thread();

create or replace function public.guard_offer_proposal()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' then
    if new.thread_id          is distinct from old.thread_id
       or new.created_by_user_id is distinct from old.created_by_user_id
       or new.created_by_side    is distinct from old.created_by_side
       or new.amount_aed         is distinct from old.amount_aed
       or new.created_at         is distinct from old.created_at then
      raise exception 'offer proposals are immutable' using errcode = 'check_violation';
    end if;
    if current_user in ('authenticated','anon') and new.status = 'ACCEPTED' then
      raise exception 'offer acceptance is performed only by the server' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists guard_offer_proposal on public.offer_proposals;
create trigger guard_offer_proposal before update on public.offer_proposals
  for each row execute function public.guard_offer_proposal();

-- --- 4. RLS — participant read-only; writes go through functions --------------
do $$
declare t text;
begin
  foreach t in array array['offer_threads','offer_proposals','offer_events'] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('alter table public.%I force  row level security;', t);
  end loop;
end $$;

-- Threads: a participant (buyer or seller) or admin may read; no direct writes.
drop policy if exists offer_threads_select on public.offer_threads;
create policy offer_threads_select on public.offer_threads
  for select using (
    buyer_user_id = auth.uid() or seller_user_id = auth.uid() or public.is_admin()
  );
drop policy if exists offer_threads_admin on public.offer_threads;
create policy offer_threads_admin on public.offer_threads
  for all using (public.is_admin()) with check (public.is_admin());

-- Proposals: readable to participants of the parent thread; no direct writes.
drop policy if exists offer_proposals_select on public.offer_proposals;
create policy offer_proposals_select on public.offer_proposals
  for select using (exists (
    select 1 from public.offer_threads th
    where th.id = offer_proposals.thread_id
      and (th.buyer_user_id = auth.uid() or th.seller_user_id = auth.uid() or public.is_admin())
  ));
drop policy if exists offer_proposals_admin on public.offer_proposals;
create policy offer_proposals_admin on public.offer_proposals
  for all using (public.is_admin()) with check (public.is_admin());

-- Events: readable to participants of the parent thread; no direct writes.
drop policy if exists offer_events_select on public.offer_events;
create policy offer_events_select on public.offer_events
  for select using (exists (
    select 1 from public.offer_threads th
    where th.id = offer_events.thread_id
      and (th.buyer_user_id = auth.uid() or th.seller_user_id = auth.uid() or public.is_admin())
  ));
drop policy if exists offer_events_admin on public.offer_events;
create policy offer_events_admin on public.offer_events
  for all using (public.is_admin()) with check (public.is_admin());

-- Customers may READ their offer rows; INSERT/UPDATE/DELETE are denied (no policy)
-- and only the SECURITY DEFINER functions below (owned by a BYPASSRLS role) write.
grant select on public.offer_threads, public.offer_proposals, public.offer_events to authenticated;

-- --- 5. Internal helpers ------------------------------------------------------
-- True when the amount is below the seller-private notification threshold (§27).
create or replace function public.offer_below_threshold(p_listing uuid, p_amount numeric)
returns boolean language sql stable security definer set search_path = public as $$
  select case
           when l.min_notification_price is null then false
           else p_amount < l.min_notification_price
         end
  from public.listings l where l.id = p_listing;
$$;

-- Raise if the listing can no longer back an offer action (paused / not LIVE /
-- materially changed since the thread snapshot / already under offer).
create or replace function public.assert_offer_actionable(
  p_listing uuid, p_listing_version int, p_publication_version int, p_self_thread uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_state public.listing_state; v_lv int; v_pv int;
begin
  select state, version, publication_version into v_state, v_lv, v_pv
    from public.listings where id = p_listing;
  if v_state is null then raise exception 'LISTING_UNAVAILABLE'; end if;
  if v_state <> 'LIVE' then raise exception 'LISTING_UNAVAILABLE'; end if;
  if v_lv <> p_listing_version or v_pv <> p_publication_version then
    raise exception 'LISTING_CHANGED';
  end if;
  if exists (
    select 1 from public.offer_threads
    where listing_id = p_listing and status = 'ACCEPTED' and id <> coalesce(p_self_thread,'00000000-0000-0000-0000-000000000000')
  ) then
    raise exception 'UNDER_OFFER';
  end if;
end $$;

-- Public-safe property summary for a thread participant or the listing owner.
-- Lets the offers UI render property context for threads on listings the buyer
-- does not own (the properties table is owner-only under RLS) and for closed /
-- paused listings (outside the LIVE marketplace view). Returns ONLY public-safe
-- fields plus seller-only operational values the API drops from buyer responses.
create or replace function public.offer_listing_summary(p_listing uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_json jsonb;
begin
  if v_uid is null then return null; end if;
  if not exists (
    select 1 from public.listings l where l.id = p_listing and l.owner_id = v_uid
  ) and not exists (
    select 1 from public.offer_threads th
    where th.listing_id = p_listing and (th.buyer_user_id = v_uid or th.seller_user_id = v_uid)
  ) then
    return null; -- not a participant / owner
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
    'minNotificationPrice', l.min_notification_price,
    'bedrooms', p.bedrooms,
    'bathrooms', p.bathrooms,
    'propertyType', p.property_type,
    'community', p.community,
    'buildingOrProject', p.building_or_project,
    'emirate', p.emirate,
    'coverPublicPath', (
      select pp.public_path from public.property_photos pp
      where pp.listing_id = l.id and pp.is_cover and pp.public_path is not null limit 1
    )
  ) into v_json
  from public.listings l
  left join public.properties p on p.id = l.property_id
  where l.id = p_listing;
  return v_json;
end $$;

-- --- 6. Mutation functions (the only write path) ------------------------------

-- Create the thread + initial buyer proposal. Idempotency / one-active-thread is
-- enforced by uniq_active_thread_per_buyer_listing; the caller resolves a
-- pre-existing active thread to "View your offer" instead.
create or replace function public.create_offer(
  p_listing uuid, p_amount numeric, p_expires_at timestamptz)
returns public.offer_threads
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_owner uuid; v_state public.listing_state; v_lv int; v_pv int; v_seq int;
  v_thread public.offer_threads; v_proposal uuid;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
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
end $$;

-- Counteroffer from whichever party is the current next-actor.
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
    status     = case when v_side = 'BUYER' then 'AWAITING_SELLER' else 'AWAITING_BUYER' end,
    next_actor = case when v_side = 'BUYER' then 'SELLER' else 'BUYER' end,
    expires_at = p_expires_at, version = version + 1, last_activity_at = now()
  where id = p_thread returning * into v_t;

  insert into public.offer_events (thread_id, event_type, actor_side, amount_aed)
  values (p_thread, case when v_side = 'BUYER' then 'BUYER_COUNTERED' else 'SELLER_COUNTERED' end, v_side, p_amount);

  v_recipient := case when v_side = 'BUYER' then v_t.seller_user_id else v_t.buyer_user_id end;
  insert into public.notifications (recipient_id, channel, kind, payload)
  values (v_recipient, 'IN_APP', case when v_side = 'BUYER' then 'OFFER_COUNTER_BUYER' else 'OFFER_COUNTER_SELLER' end,
          jsonb_build_object('threadId', p_thread));
  insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  values (v_uid, case when v_side = 'BUYER' then 'OFFER_COUNTERED_BY_BUYER' else 'OFFER_COUNTERED_BY_SELLER' end,
          'offer_thread', p_thread, '{}'::jsonb);

  return v_t;
end $$;

-- Accept the current proposal: atomic, single-acceptance, closes competing threads.
create or replace function public.accept_offer(
  p_thread uuid, p_proposal uuid, p_expected_version int)
returns public.offer_threads
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_t public.offer_threads; v_side public.offer_side; v_cur public.offer_proposals;
  v_recipient uuid; v_other public.offer_threads;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
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
end $$;

-- Reject the current proposal (terminal). Seller reason is predefined + private.
create or replace function public.reject_offer(
  p_thread uuid, p_expected_version int, p_reason text)
returns public.offer_threads
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid(); v_t public.offer_threads; v_side public.offer_side; v_recipient uuid;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
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
end $$;

-- Buyer withdraws an active thread before acceptance.
create or replace function public.withdraw_offer(p_thread uuid, p_expected_version int)
returns public.offer_threads
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_t public.offer_threads;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
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
end $$;

-- Close every active thread for a listing (called when the seller pauses or
-- materially edits a LIVE listing — §28). Never auto-resumes (§28.2).
create or replace function public.close_listing_offers(p_listing uuid, p_reason text)
returns integer
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_t public.offer_threads; v_n int := 0; v_evt public.offer_event_type;
begin
  v_evt := case when p_reason = 'LISTING_PAUSED' then 'LISTING_PAUSED' else 'LISTING_UNAVAILABLE' end;
  for v_t in
    select * from public.offer_threads
    where listing_id = p_listing and status in ('DRAFT','AWAITING_SELLER','AWAITING_BUYER')
  loop
    update public.offer_proposals set status = 'CLOSED'
      where thread_id = v_t.id and status in ('CURRENT','SUPERSEDED');
    update public.offer_threads set
      status = 'CLOSED_LISTING_UNAVAILABLE', next_actor = 'NONE',
      closed_reason = p_reason, version = version + 1, last_activity_at = now()
    where id = v_t.id;
    insert into public.offer_events (thread_id, event_type, metadata)
    values (v_t.id, v_evt, jsonb_build_object('reason', p_reason));
    insert into public.notifications (recipient_id, channel, kind, payload)
    values (v_t.buyer_user_id, 'IN_APP', 'OFFER_LISTING_UNAVAILABLE', jsonb_build_object('threadId', v_t.id));
    insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
    values (v_uid, 'OFFER_CLOSED_LISTING_UNAVAILABLE', 'offer_thread', v_t.id, jsonb_build_object('reason', p_reason));
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

-- Lazily mark threads whose current proposal has expired (§25.2 process-on-read).
create or replace function public.expire_due_offers()
returns integer
language plpgsql security definer set search_path = public as $$
declare v_t public.offer_threads; v_n int := 0;
begin
  for v_t in
    select th.* from public.offer_threads th
    join public.offer_proposals p on p.id = th.current_proposal_id
    where th.status in ('AWAITING_SELLER','AWAITING_BUYER')
      and p.expires_at is not null and p.expires_at <= now()
  loop
    update public.offer_proposals set status = 'EXPIRED' where id = v_t.current_proposal_id;
    update public.offer_threads set
      status = 'EXPIRED', next_actor = 'NONE', closed_reason = 'EXPIRED',
      version = version + 1, last_activity_at = now()
    where id = v_t.id;
    insert into public.offer_events (thread_id, event_type) values (v_t.id, 'OFFER_EXPIRED');
    insert into public.notifications (recipient_id, channel, kind, payload)
    values (v_t.buyer_user_id, 'IN_APP', 'OFFER_EXPIRED', jsonb_build_object('threadId', v_t.id)),
           (v_t.seller_user_id, 'IN_APP', 'OFFER_EXPIRED', jsonb_build_object('threadId', v_t.id));
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

-- Record a "seller viewed" timeline event, at most once (§20.3 optional event).
create or replace function public.mark_offer_viewed(p_thread uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_t public.offer_threads;
begin
  select * into v_t from public.offer_threads where id = p_thread;
  if not found or v_uid <> v_t.seller_user_id then return; end if;
  if not exists (select 1 from public.offer_events where thread_id = p_thread and event_type = 'OFFER_VIEWED') then
    insert into public.offer_events (thread_id, event_type, actor_side) values (p_thread, 'OFFER_VIEWED', 'SELLER');
  end if;
end $$;

grant execute on function
  public.create_offer(uuid, numeric, timestamptz),
  public.submit_counter(uuid, numeric, timestamptz, int),
  public.accept_offer(uuid, uuid, int),
  public.reject_offer(uuid, int, text),
  public.withdraw_offer(uuid, int),
  public.close_listing_offers(uuid, text),
  public.expire_due_offers(),
  public.mark_offer_viewed(uuid),
  public.offer_below_threshold(uuid, numeric),
  public.assert_offer_actionable(uuid, int, int, uuid),
  public.offer_listing_summary(uuid)
  to authenticated, service_role;

-- --- 7. Realtime: stream thread + timeline changes to participants ------------
-- RLS scopes delivery to participants; anon receives nothing (§29, ADR-0018).
do $$
begin
  alter publication supabase_realtime add table public.offer_threads;
exception when duplicate_object then null; end $$;
do $$
begin
  alter publication supabase_realtime add table public.offer_events;
exception when duplicate_object then null; end $$;
