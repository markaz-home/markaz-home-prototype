-- Week 6 — Admin Portal foundation (ADR-0024/0025/0029).
-- Adds: customer account restriction (ACTIVE / ACTIONS_RESTRICTED), append-only admin_notes,
-- transaction progression-pause, an is_restricted() helper + guards, and realtime publication
-- for the publication queue. Admin writes go through SECURITY DEFINER functions (…0813).

-- ---------------------------------------------------------------------------
-- 1. Customer restriction (two-state; does NOT delete data or block sign-in — spec §15).
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists restricted_at timestamptz,
  add column if not exists restriction_reason text,
  add column if not exists restricted_by uuid references public.profiles (id) on delete set null;

-- Only the elevated role (SECURITY DEFINER admin functions) may set/clear restriction;
-- customers (authenticated/anon) can never restrict themselves or others.
create or replace function public.guard_profile_restriction()
returns trigger language plpgsql as $$
begin
  if (new.restricted_at is distinct from old.restricted_at
      or new.restriction_reason is distinct from old.restriction_reason
      or new.restricted_by is distinct from old.restricted_by)
     and current_user in ('authenticated', 'anon') then
    raise exception 'account restriction can be changed only by MARKAZ Operations'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;
drop trigger if exists guard_profile_restriction on public.profiles;
create trigger guard_profile_restriction before update on public.profiles
  for each row execute function public.guard_profile_restriction();

-- Authoritative "is this customer restricted?" (bypasses caller RLS; used by offer fns).
create or replace function public.is_restricted(p_uid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.profiles where id = p_uid and restricted_at is not null);
$$;
grant execute on function public.is_restricted(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. admin_notes — append-only, admin-only, per-entity (spec §16).
-- ---------------------------------------------------------------------------
create type public.admin_note_category as enum (
  'REVIEW', 'CUSTOMER_SUPPORT', 'LISTING_INVESTIGATION', 'OFFER_INVESTIGATION',
  'TRANSACTION_ISSUE', 'VERIFICATION_ISSUE', 'FOLLOW_UP', 'CORRECTION'
);
create table public.admin_notes (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  category public.admin_note_category not null,
  body text not null,
  follow_up_date date,
  created_by_admin_id uuid references public.profiles (id) on delete set null,
  supersedes_note_id uuid references public.admin_notes (id) on delete set null,
  hidden_at timestamptz,
  created_at timestamptz not null default now(),
  constraint admin_notes_body_len check (char_length(body) between 3 and 1000)
);
create index admin_notes_entity_idx on public.admin_notes (entity_type, entity_id, created_at desc);
create index admin_notes_category_idx on public.admin_notes (category);

alter table public.admin_notes enable row level security;
-- Admin-only read; never visible to customers. All writes go through SECURITY DEFINER fns.
create policy admin_notes_admin_read on public.admin_notes for select using (public.is_admin());
grant select on public.admin_notes to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Transaction progression-pause (operational flag, not a status; spec §28.2).
-- ---------------------------------------------------------------------------
alter table public.transactions
  add column if not exists progression_paused_at timestamptz,
  add column if not exists progression_pause_reason text;

-- ---------------------------------------------------------------------------
-- 4. Realtime — publish the publication-request table for the Admin review queue.
-- ---------------------------------------------------------------------------
do $$
begin
  begin alter publication supabase_realtime add table public.listing_publication_requests; exception when duplicate_object then null; end;
end $$;

-- Audit history is append-only for everyone (incl. admins): keep insert+select, revoke the rest.
revoke update, delete, truncate on public.audit_events from authenticated;
