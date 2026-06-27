-- =============================================================================
-- MARKAZ Home — canonical migration 01: profiles foundation
-- Single canonical history (§6A.4). Drizzle (packages/db) mirrors these types.
-- Assumes the Supabase platform schema (auth.*, roles authenticated/anon/
-- service_role, auth.uid()) — true for the local CLI stack and the future
-- self-hosted platform.
-- =============================================================================

create extension if not exists "pgcrypto";

-- --- Enums -------------------------------------------------------------------
do $$ begin
  create type public.account_type as enum ('CUSTOMER', 'ADMIN');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.identity_verification_status as enum
    ('NOT_STARTED', 'PENDING', 'VERIFIED_DEMO', 'FAILED_DEMO');
exception when duplicate_object then null; end $$;

-- --- updated_at helper -------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- --- Profiles ----------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  account_type public.account_type not null default 'CUSTOMER',
  identity_verification_status public.identity_verification_status
    not null default 'NOT_STARTED',
  terms_accepted_at timestamptz,
  privacy_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists profiles_email_key on public.profiles (lower(email));
create index if not exists profiles_account_type_idx on public.profiles (account_type);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- --- Idempotent profile creation on auth signup ------------------------------
-- CUSTOMER is the only safe default. Runs SECURITY DEFINER so a brand-new auth
-- user always gets exactly one profile row, regardless of who inserts.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, account_type, identity_verification_status)
  values (new.id, new.email, 'CUSTOMER', 'NOT_STARTED')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- --- Prevent customers from promoting themselves to ADMIN --------------------
-- account_type may only change when performed by a privileged role
-- (service_role / table owner). Customer-scoped sessions run as `authenticated`.
create or replace function public.prevent_account_type_escalation()
returns trigger
language plpgsql
as $$
begin
  if new.account_type is distinct from old.account_type then
    if current_user not in ('postgres', 'service_role', 'supabase_admin') then
      raise exception 'account_type cannot be changed by % ', current_user
        using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_prevent_escalation on public.profiles;
create trigger profiles_prevent_escalation
  before update on public.profiles
  for each row execute function public.prevent_account_type_escalation();

-- --- Admin predicate (SECURITY DEFINER avoids RLS recursion) -----------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.account_type = 'ADMIN'
  );
$$;

-- =============================================================================
-- Row-Level Security: profiles
-- =============================================================================
alter table public.profiles enable row level security;
alter table public.profiles force row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select using (id = auth.uid());

drop policy if exists profiles_select_admin on public.profiles;
create policy profiles_select_admin on public.profiles
  for select using (public.is_admin());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles
  for insert with check (id = auth.uid() and account_type = 'CUSTOMER');

-- --- Grants (RLS still gates rows) -------------------------------------------
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update on public.profiles to authenticated;
grant execute on function public.is_admin() to anon, authenticated, service_role;
