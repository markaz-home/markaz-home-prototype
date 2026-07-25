-- =============================================================================
-- UAE PASS Staging identity linking
--
-- Adds a distinct persisted result for a real staging-provider link. The browser
-- cannot write this value directly: a SECURITY DEFINER function re-derives the
-- actor from auth.uid(), confirms the linked Supabase Auth identity, and records
-- the profile update + audit event atomically.
-- =============================================================================

alter type public.identity_verification_status
  add value if not exists 'VERIFIED_STAGING';

create or replace function public.guard_staging_identity_status()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.identity_verification_status is distinct from old.identity_verification_status
     and (
       new.identity_verification_status = 'VERIFIED_STAGING'
       or old.identity_verification_status = 'VERIFIED_STAGING'
     )
     and current_user not in ('postgres', 'service_role', 'supabase_admin')
  then
    raise exception 'VERIFIED_STAGING may only be changed by the verified identity workflow'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_staging_identity_status on public.profiles;
create trigger profiles_guard_staging_identity_status
  before update of identity_verification_status on public.profiles
  for each row execute function public.guard_staging_identity_status();

create or replace function public.sync_uae_pass_staging_identity()
returns public.identity_verification_status
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_current public.identity_verification_status;
begin
  if v_actor is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = 'insufficient_privilege';
  end if;

  if not exists (
    select 1
    from auth.identities i
    where i.user_id = v_actor
      and i.provider = 'custom:uae-pass'
  ) then
    raise exception 'UAE_PASS_IDENTITY_NOT_LINKED' using errcode = 'P0001';
  end if;

  select p.identity_verification_status
    into v_current
  from public.profiles p
  where p.id = v_actor
    and p.account_type = 'CUSTOMER'
  for update;

  if not found then
    raise exception 'CUSTOMER_PROFILE_NOT_FOUND' using errcode = 'P0001';
  end if;

  -- Refreshes and repeated callback handling must not create duplicate audit rows.
  if v_current = 'VERIFIED_STAGING' then
    return v_current;
  end if;

  if v_current not in ('NOT_STARTED', 'PENDING', 'FAILED_DEMO') then
    raise exception 'IDENTITY_STATUS_NOT_ELIGIBLE' using errcode = 'P0001';
  end if;

  update public.profiles
  set identity_verification_status = 'VERIFIED_STAGING',
      onboarding_completed_at = coalesce(onboarding_completed_at, now())
  where id = v_actor;

  insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
  values (
    v_actor,
    'UAE_PASS_STAGING_IDENTITY_LINKED',
    'profile',
    v_actor,
    '{}'::jsonb
  );

  return 'VERIFIED_STAGING';
end;
$$;

revoke all on function public.sync_uae_pass_staging_identity() from public;
grant execute on function public.sync_uae_pass_staging_identity() to authenticated;
