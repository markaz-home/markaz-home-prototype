-- =============================================================================
-- MARKAZ Home — provider-first customer onboarding
--
-- UAE PASS and Google may now create a CUSTOMER on first authentication. The
-- provider subject remains canonical in auth.identities; application profile
-- fields are a minimal projection. Emirates ID is never copied to public tables.
-- Existing customers may still link an additional identity explicitly.
-- =============================================================================

-- Compatibility for hosted tenants that still have the old Before User Created
-- hook configured. Provider signup is now controlled by profile completion, RLS,
-- and the CUSTOMER-only creation trigger, so the old login-only rejection retires.
create or replace function public.hook_prevent_unlinked_uae_pass_signup(event jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
begin
  return '{}'::jsonb;
end;
$$;

grant execute
  on function public.hook_prevent_unlinked_uae_pass_signup(jsonb)
  to supabase_auth_admin;
revoke execute
  on function public.hook_prevent_unlinked_uae_pass_signup(jsonb)
  from authenticated, anon, public;

-- Create the single application profile for every Auth user. OAuth metadata is
-- useful only for prefill: terms/privacy remain null until MARKAZ collects them.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_provider text := coalesce(new.raw_app_meta_data->>'provider', '');
  v_name text := coalesce(
    nullif(btrim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(btrim(new.raw_user_meta_data->>'name'), ''),
    nullif(btrim(new.raw_user_meta_data->>'fullnameEN'), '')
  );
  v_raw_phone text := coalesce(
    nullif(btrim(new.raw_user_meta_data->>'phone'), ''),
    nullif(btrim(new.raw_user_meta_data->>'mobile'), '')
  );
  v_phone text;
begin
  if v_name is not null then
    v_name := btrim(regexp_replace(replace(v_name, ',', ' '), '\s+', ' ', 'g'));
  end if;

  if v_raw_phone ~ '^\+[1-9][0-9]{7,14}$' then
    v_phone := v_raw_phone;
  elsif v_raw_phone ~ '^971[0-9]{7,12}$' then
    v_phone := '+' || v_raw_phone;
  end if;

  insert into public.profiles (
    id,
    email,
    full_name,
    phone_e164,
    phone_verified_at,
    phone_verification_source,
    account_type,
    identity_verification_status,
    terms_accepted_at,
    privacy_accepted_at,
    onboarding_completed_at
  )
  values (
    new.id,
    coalesce(nullif(btrim(new.email), ''), new.id::text || '@no-email.uaepass.invalid'),
    v_name,
    v_phone,
    case when v_provider = 'custom:uae-pass' and v_phone is not null then now() end,
    case
      when v_provider = 'custom:uae-pass' and v_phone is not null
        then 'UAE_PASS'::public.phone_verification_source
    end,
    'CUSTOMER',
    'NOT_STARTED',
    case when (new.raw_user_meta_data->>'terms_accepted') = 'true' then now() end,
    case when (new.raw_user_meta_data->>'privacy_accepted') = 'true' then now() end,
    case
      when v_name is not null
        and (new.raw_user_meta_data->>'terms_accepted') = 'true'
        and (new.raw_user_meta_data->>'privacy_accepted') = 'true'
      then now()
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- A UAE PASS callback runs this after Auth has persisted auth.identities. Only
-- missing application fields are filled; linking UAE PASS never overwrites a
-- customer's existing name, email, or phone. Identity data is never accepted
-- from the browser and Emirates ID is deliberately ignored.
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
  v_name text;
  v_raw_phone text;
  v_phone text;
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

  v_name := coalesce(
    nullif(btrim(v_identity->>'full_name'), ''),
    nullif(btrim(v_identity->>'fullnameEN'), ''),
    nullif(btrim(v_identity->>'name'), '')
  );
  if v_name is not null then
    v_name := btrim(regexp_replace(replace(v_name, ',', ' '), '\s+', ' ', 'g'));
  end if;

  v_raw_phone := coalesce(
    nullif(btrim(v_identity->>'phone'), ''),
    nullif(btrim(v_identity->>'mobile'), '')
  );
  if v_raw_phone ~ '^\+[1-9][0-9]{7,14}$' then
    v_phone := v_raw_phone;
  elsif v_raw_phone ~ '^971[0-9]{7,12}$' then
    v_phone := '+' || v_raw_phone;
  end if;

  update public.profiles p
  set full_name = coalesce(nullif(btrim(p.full_name), ''), v_name),
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
