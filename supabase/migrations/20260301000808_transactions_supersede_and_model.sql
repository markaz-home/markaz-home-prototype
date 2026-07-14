-- Week 5 — Accepted Offer & Transaction Tracker: canonical model (ADR-0019).
--
-- Supersedes the empty Week-1 placeholder (`transactions` + `transaction_stage_history`
-- + `transaction_stage` enum), which also carried a now-broken FK (`offer_id -> offers`,
-- a table dropped in ...0804). One canonical transaction per accepted offer thread +
-- accepted proposal. Customers get read-only RLS; every consequential write goes through
-- SECURITY DEFINER functions (migration ...0809), mirroring the Week-4 offer model.

-- ---------------------------------------------------------------------------
-- 0. Drop the obsolete Week-1 placeholder (empty; only admin metrics read it).
-- ---------------------------------------------------------------------------
drop table if exists public.transaction_stage_history cascade;
drop table if exists public.transactions cascade;
drop type  if exists public.transaction_stage;

-- ---------------------------------------------------------------------------
-- 1. Enums
-- ---------------------------------------------------------------------------
create type public.transaction_status as enum (
  'INITIATED', 'CONFIRMATION', 'DEPOSIT', 'DOCUMENTS', 'DUE_DILIGENCE',
  'TRANSFER', 'COMPLETION', 'COMPLETED_DEMO',
  'CANCELLATION_PENDING', 'CANCELLED', 'FAILED'
);
create type public.transaction_next_actor as enum ('BUYER', 'SELLER', 'BOTH', 'SYSTEM', 'NONE');
create type public.transaction_actor as enum ('BUYER', 'SELLER', 'BOTH', 'SYSTEM');
create type public.transaction_task_status as enum (
  'PENDING', 'ACTION_REQUIRED', 'IN_PROGRESS', 'COMPLETED_DEMO', 'BLOCKED', 'FAILED', 'SKIPPED'
);
create type public.transaction_purchase_route as enum ('CASH', 'FINANCING');
create type public.transaction_financing_status as enum (
  'NOT_STARTED', 'IN_PROGRESS', 'CONFIRMED_DEMO', 'UNABLE_TO_PROCEED'
);
create type public.transaction_document_status as enum (
  'UPLOADED', 'ACCEPTED_DEMO', 'NEEDS_REPLACEMENT', 'REMOVED'
);
create type public.transaction_event_type as enum (
  'TRANSACTION_CREATED', 'DETAILS_CONFIRMED', 'PURCHASE_ROUTE_SELECTED', 'FINANCING_STATUS_UPDATED',
  'DEMO_DEPOSIT_CONFIRMED', 'DOCUMENT_UPLOADED', 'DOCUMENT_REPLACED', 'DOCUMENT_REMOVED',
  'SUMMARY_REVIEWED', 'DUE_DILIGENCE_COMPLETED_DEMO', 'TRANSFER_DATE_PROPOSED',
  'TRANSFER_READINESS_CONFIRMED', 'TRANSFER_APPOINTMENT_SIMULATED', 'COMPLETION_CONFIRMED',
  'COMPLETED_DEMO', 'CANCELLATION_REQUESTED', 'CANCELLATION_DECLINED', 'CANCELLED', 'FAILED'
);

-- ---------------------------------------------------------------------------
-- 2. transactions — one per accepted offer thread + accepted proposal.
-- ---------------------------------------------------------------------------
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  -- Immutable identity, all derived server-side from the accepted offer thread.
  offer_thread_id uuid not null references public.offer_threads (id) on delete cascade,
  accepted_proposal_id uuid not null references public.offer_proposals (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  buyer_user_id uuid not null references public.profiles (id) on delete cascade,
  seller_user_id uuid not null references public.profiles (id) on delete cascade,
  accepted_amount_aed numeric(14,2) not null,
  -- Workflow state.
  status public.transaction_status not null default 'INITIATED',
  next_actor public.transaction_next_actor not null default 'BOTH',
  purchase_route public.transaction_purchase_route,
  financing_status public.transaction_financing_status,
  deposit_amount_aed numeric(14,2),
  deposit_confirmed_at timestamptz,
  transfer_preferred_date date,
  transfer_appointment_at timestamptz,
  cancellation_reason text,
  cancellation_requested_by uuid references public.profiles (id) on delete set null,
  failure_category text,
  version int not null default 1,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transactions_buyer_ne_seller check (buyer_user_id <> seller_user_id),
  constraint transactions_amount_positive check (accepted_amount_aed > 0),
  -- Terminal timestamps only in terminal states.
  constraint transactions_completed_ts check (
    (status = 'COMPLETED_DEMO') = (completed_at is not null)),
  constraint transactions_cancelled_ts check (
    (status = 'CANCELLED') = (cancelled_at is not null))
);

-- Single transaction per accepted thread AND per accepted proposal (DB-enforced idempotency).
create unique index uniq_transaction_per_thread on public.transactions (offer_thread_id);
create unique index uniq_transaction_per_proposal on public.transactions (accepted_proposal_id);
create index transactions_buyer_idx on public.transactions (buyer_user_id);
create index transactions_seller_idx on public.transactions (seller_user_id);
create index transactions_listing_idx on public.transactions (listing_id);

-- ---------------------------------------------------------------------------
-- 3. transaction_tasks — persisted milestones (never derive the whole UI from status).
-- ---------------------------------------------------------------------------
create table public.transaction_tasks (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions (id) on delete cascade,
  code text not null,
  stage public.transaction_status not null,
  sequence int not null,
  assigned_actor public.transaction_actor not null,
  required boolean not null default true,
  status public.transaction_task_status not null default 'PENDING',
  started_at timestamptz,
  completed_at timestamptz,
  failure_category text,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transaction_tasks_code_unique unique (transaction_id, code)
);
create index transaction_tasks_tx_idx on public.transaction_tasks (transaction_id, sequence);

-- ---------------------------------------------------------------------------
-- 4. transaction_documents — private, participant-scoped prototype documents.
-- ---------------------------------------------------------------------------
create table public.transaction_documents (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions (id) on delete cascade,
  uploaded_by uuid not null references public.profiles (id) on delete cascade,
  document_type text not null,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes int not null,
  status public.transaction_document_status not null default 'UPLOADED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transaction_documents_mime check (mime_type in ('application/pdf', 'image/jpeg', 'image/png')),
  constraint transaction_documents_size check (size_bytes > 0 and size_bytes <= 10485760)
);
-- At most one active (non-removed) file per (transaction, uploader, type).
create unique index uniq_active_transaction_document
  on public.transaction_documents (transaction_id, uploaded_by, document_type)
  where status <> 'REMOVED';
create index transaction_documents_tx_idx on public.transaction_documents (transaction_id);

-- ---------------------------------------------------------------------------
-- 5. transaction_events — participant-readable timeline.
-- ---------------------------------------------------------------------------
create table public.transaction_events (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions (id) on delete cascade,
  event_type public.transaction_event_type not null,
  actor public.transaction_actor,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index transaction_events_tx_idx on public.transaction_events (transaction_id, created_at);

-- ---------------------------------------------------------------------------
-- 6. updated_at triggers (reuse the existing set_updated_at()).
-- ---------------------------------------------------------------------------
create trigger transactions_set_updated_at before update on public.transactions
  for each row execute function public.set_updated_at();
create trigger transaction_tasks_set_updated_at before update on public.transaction_tasks
  for each row execute function public.set_updated_at();
create trigger transaction_documents_set_updated_at before update on public.transaction_documents
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 7. Immutable identity guard on transactions (identity fields never change;
--    customers can't force ACCEPTED-style terminal writes directly).
-- ---------------------------------------------------------------------------
create or replace function public.guard_transaction()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' then
    if new.offer_thread_id is distinct from old.offer_thread_id
       or new.accepted_proposal_id is distinct from old.accepted_proposal_id
       or new.listing_id is distinct from old.listing_id
       or new.buyer_user_id is distinct from old.buyer_user_id
       or new.seller_user_id is distinct from old.seller_user_id
       or new.accepted_amount_aed is distinct from old.accepted_amount_aed
       or new.reference is distinct from old.reference then
      raise exception 'transaction identity is immutable' using errcode = 'check_violation';
    end if;
    if current_user in ('authenticated', 'anon')
       and (new.status is distinct from old.status
            or new.next_actor is distinct from old.next_actor) then
      raise exception 'transaction state transitions are performed only by the server'
        using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end $$;
create trigger guard_transaction before update on public.transactions
  for each row execute function public.guard_transaction();

-- ---------------------------------------------------------------------------
-- 8. RLS — enable (customers read-only); writes go through SECURITY DEFINER fns.
-- ---------------------------------------------------------------------------
alter table public.transactions enable row level security;
alter table public.transaction_tasks enable row level security;
alter table public.transaction_documents enable row level security;
alter table public.transaction_events enable row level security;

-- Participant (buyer/seller) or admin may read the shared transaction.
create policy transactions_select on public.transactions
  for select using (buyer_user_id = auth.uid() or seller_user_id = auth.uid() or public.is_admin());
create policy transactions_admin on public.transactions
  for all using (public.is_admin()) with check (public.is_admin());

create policy transaction_tasks_select on public.transaction_tasks
  for select using (exists (
    select 1 from public.transactions t where t.id = transaction_tasks.transaction_id
      and (t.buyer_user_id = auth.uid() or t.seller_user_id = auth.uid() or public.is_admin())));
create policy transaction_tasks_admin on public.transaction_tasks
  for all using (public.is_admin()) with check (public.is_admin());

-- Documents: a participant sees only their OWN uploaded files (metadata); the other
-- party's private files are never exposed here (checklist completeness is projected
-- server-side). Admin (future) may read all.
create policy transaction_documents_select on public.transaction_documents
  for select using (
    uploaded_by = auth.uid()
    or public.is_admin()
    or exists (select 1 from public.transactions t where t.id = transaction_documents.transaction_id
                 and (t.buyer_user_id = auth.uid() or t.seller_user_id = auth.uid()) and false));
create policy transaction_documents_admin on public.transaction_documents
  for all using (public.is_admin()) with check (public.is_admin());

create policy transaction_events_select on public.transaction_events
  for select using (exists (
    select 1 from public.transactions t where t.id = transaction_events.transaction_id
      and (t.buyer_user_id = auth.uid() or t.seller_user_id = auth.uid() or public.is_admin())));
create policy transaction_events_admin on public.transaction_events
  for all using (public.is_admin()) with check (public.is_admin());

-- Read-only grants for customers (no direct insert/update/delete).
grant select on public.transactions, public.transaction_tasks,
                public.transaction_documents, public.transaction_events to authenticated;

-- ---------------------------------------------------------------------------
-- 9. Private transaction-documents storage bucket + participant-scoped policy.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('transaction-documents', 'transaction-documents', false)
on conflict (id) do update set public = excluded.public;

-- Uploader may write/read their own object; both participants + admin may read; object
-- key convention is `${transactionId}/${uploaderId}/${documentId}` (enforced in the API).
drop policy if exists transaction_documents_owner_rw on storage.objects;
create policy transaction_documents_owner_rw on storage.objects
  for all to authenticated
  using (bucket_id = 'transaction-documents' and (owner = auth.uid() or public.is_admin()))
  with check (bucket_id = 'transaction-documents' and owner = auth.uid());
