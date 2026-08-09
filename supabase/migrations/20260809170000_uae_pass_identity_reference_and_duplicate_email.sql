-- =============================================================================
-- UAE PASS identity reference + cross-provider duplicate-email prevention
--
-- UAE PASS may return the verified `idn` claim for Citizen/Resident SOP2/SOP3
-- identities. MARKAZ retains only a salted, one-way match reference in a locked
-- non-API schema. The raw Emirates ID is never copied into public.profiles.
--
-- UAE PASS Auth users intentionally have no auth.users.email (ADR-0035). Block a
-- later password signup whose email already belongs to an application profile
-- before GoTrue inserts a second auth.users row. The client maps the stable marker
-- to the existing anti-enumeration warning; no email/provider is returned.
-- =============================================================================

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.customer_identity_references (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  provider text not null default 'UAE_PASS'
    check (provider = 'UAE_PASS'),
  emirates_id_hash text not null
    check (emirates_id_hash like '$2%' and char_length(emirates_id_hash) = 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table private.customer_identity_references enable row level security;
alter table private.customer_identity_references force row level security;
revoke all on private.customer_identity_references from public, anon, authenticated;

-- The hook is SECURITY INVOKER. Give Supabase Auth the smallest table privilege
-- it needs and an explicit RLS policy, following Supabase's hook security model.
grant usage on schema public to supabase_auth_admin;
grant select (email) on public.profiles to supabase_auth_admin;

drop policy if exists profiles_auth_duplicate_email_lookup on public.profiles;
create policy profiles_auth_duplicate_email_lookup on public.profiles
  for select
  to supabase_auth_admin
  using (true);

create or replace function public.hook_prevent_unlinked_uae_pass_signup(event jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_email text := lower(nullif(btrim(event->'user'->>'email'), ''));
begin
  if v_email is not null and exists (
    select 1
    from public.profiles p
    where lower(p.email) = v_email
  ) then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 422,
        'message', 'MARKAZ_ACCOUNT_ALREADY_REGISTERED'
      )
    );
  end if;

  return '{}'::jsonb;
end;
$$;

grant execute
  on function public.hook_prevent_unlinked_uae_pass_signup(jsonb)
  to supabase_auth_admin;
revoke execute
  on function public.hook_prevent_unlinked_uae_pass_signup(jsonb)
  from authenticated, anon, public;

create or replace function public.sync_uae_pass_staging_identity()
returns public.identity_verification_status
language plpgsql
security definer
set search_path = public, auth
set lock_timeout = '2s'
as $$
declare
  v_actor uuid := auth.uid();
  v_current public.identity_verification_status;
  v_identity jsonb;
  v_claims jsonb;
  v_email text;
  v_name text;
  v_raw_phone text;
  v_phone text;
  v_raw_emirates_id text;
  v_emirates_id text;
  v_existing_emirates_id_hash text;
begin
  if v_actor is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = 'insufficient_privilege';
  end if;

  select i.identity_data
    into v_identity
  from auth.identities i
  where i.user_id = v_actor
    and i.provider = 'custom:uae-pass'
  order by i.created_at
  limit 1;

  if not found then
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

  if v_current <> 'VERIFIED_STAGING'
     and v_current not in ('NOT_STARTED', 'PENDING', 'FAILED_DEMO') then
    raise exception 'IDENTITY_STATUS_NOT_ELIGIBLE' using errcode = 'P0001';
  end if;

  v_claims := coalesce(v_identity->'custom_claims', '{}'::jsonb);
  v_email := lower(nullif(btrim(v_claims->>'email'), ''));
  if v_email is not null and (
    char_length(v_email) > 320
    or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ) then
    v_email := null;
  end if;

  v_name := coalesce(
    nullif(btrim(v_identity->>'full_name'), ''),
    nullif(btrim(v_identity->>'fullnameEN'), ''),
    nullif(btrim(v_identity->>'name'), ''),
    nullif(btrim(v_claims->>'fullnameEN'), '')
  );
  if v_name is not null then
    v_name := btrim(regexp_replace(replace(v_name, ',', ' '), '\s+', ' ', 'g'));
  end if;

  v_raw_phone := coalesce(
    nullif(btrim(v_identity->>'phone'), ''),
    nullif(btrim(v_identity->>'mobile'), ''),
    nullif(btrim(v_claims->>'mobile'), '')
  );
  if v_raw_phone ~ '^\+[1-9][0-9]{7,14}$' then
    v_phone := v_raw_phone;
  elsif v_raw_phone ~ '^971[0-9]{7,12}$' then
    v_phone := '+' || v_raw_phone;
  end if;

  -- Accept only the trusted UAE PASS claim, normalize presentation separators,
  -- and retain a bcrypt reference. It can support a future equality check but
  -- cannot be rendered or recovered as an Emirates ID number.
  v_raw_emirates_id := nullif(btrim(v_claims->>'idn'), '');
  if v_raw_emirates_id is not null then
    v_emirates_id := regexp_replace(v_raw_emirates_id, '[-[:space:]]', '', 'g');
    if v_emirates_id !~ '^[0-9]{15}$' then
      v_emirates_id := null;
    end if;
  end if;

  if v_emirates_id is not null then
    select r.emirates_id_hash
      into v_existing_emirates_id_hash
    from private.customer_identity_references r
    where r.profile_id = v_actor
    for update;

    if not found then
      insert into private.customer_identity_references (
        profile_id,
        emirates_id_hash
      ) values (
        v_actor,
        extensions.crypt(v_emirates_id, extensions.gen_salt('bf', 12))
      );
    elsif extensions.crypt(v_emirates_id, v_existing_emirates_id_hash)
          <> v_existing_emirates_id_hash then
      update private.customer_identity_references r
      set emirates_id_hash = extensions.crypt(
            v_emirates_id,
            extensions.gen_salt('bf', 12)
          ),
          updated_at = now()
      where r.profile_id = v_actor;
    end if;
  end if;

  update public.profiles p
  set email = case
        when p.email = v_actor::text || '@no-email.uaepass.invalid'
          and v_email is not null
          and not exists (
            select 1
            from public.profiles other
            where other.id <> v_actor
              and lower(other.email) = v_email
          )
        then v_email
        else p.email
      end,
      full_name = coalesce(nullif(btrim(p.full_name), ''), v_name),
      phone_e164 = coalesce(p.phone_e164, v_phone),
      phone_verified_at = case
        when p.phone_e164 is null and v_phone is not null then now()
        else p.phone_verified_at
      end,
      phone_verification_source = case
        when p.phone_e164 is null and v_phone is not null
          then 'UAE_PASS'::public.phone_verification_source
        else p.phone_verification_source
      end,
      identity_verification_status = 'VERIFIED_STAGING',
      onboarding_completed_at = case
        when coalesce(nullif(btrim(p.full_name), ''), v_name) is not null
          and p.terms_accepted_at is not null
          and p.privacy_accepted_at is not null
        then coalesce(p.onboarding_completed_at, now())
        else p.onboarding_completed_at
      end
  where p.id = v_actor;

  if v_current <> 'VERIFIED_STAGING' then
    insert into public.audit_events (actor_id, action, entity_type, entity_id, metadata)
    values (
      v_actor,
      'UAE_PASS_STAGING_IDENTITY_LINKED',
      'profile',
      v_actor,
      jsonb_build_object(
        'prefilled_email', v_email is not null,
        'prefilled_name', v_name is not null,
        'prefilled_phone', v_phone is not null
      )
    );
  end if;

  return 'VERIFIED_STAGING';
end;
$$;

revoke all on function public.sync_uae_pass_staging_identity() from public;
grant execute on function public.sync_uae_pass_staging_identity() to authenticated;
