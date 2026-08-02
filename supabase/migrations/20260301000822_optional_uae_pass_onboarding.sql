-- =============================================================================
-- MARKAZ Home — UAE PASS is optional sign-in, not required onboarding
--
-- Account setup now completes after profile details/consent plus the Supabase
-- email-verification gate. Identity state remains available for UAE PASS login
-- and future regulated workflows, but it no longer controls dashboard access.
-- =============================================================================

-- Existing email/password customers with complete profile data may have been
-- left at the retired UAE PASS checkpoint. Mark that profile setup complete.
update public.profiles
set onboarding_completed_at = coalesce(onboarding_completed_at, now())
where account_type = 'CUSTOMER'
  and nullif(btrim(full_name), '') is not null
  and terms_accepted_at is not null
  and privacy_accepted_at is not null
  and onboarding_completed_at is null;

-- New email/password sign-ups already provide name + both consent flags. Record
-- profile completion at creation; email confirmation is still independently and
-- authoritatively enforced by Supabase Auth + requireCustomerStep.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id, email, full_name, account_type, identity_verification_status,
    terms_accepted_at, privacy_accepted_at, onboarding_completed_at
  )
  values (
    new.id,
    coalesce(nullif(btrim(new.email), ''), new.id::text || '@no-email.uaepass.invalid'),
    nullif(btrim(new.raw_user_meta_data->>'full_name'), ''),
    'CUSTOMER',
    'NOT_STARTED',
    case when (new.raw_user_meta_data->>'terms_accepted') = 'true' then now() end,
    case when (new.raw_user_meta_data->>'privacy_accepted') = 'true' then now() end,
    case
      when nullif(btrim(new.raw_user_meta_data->>'full_name'), '') is not null
        and (new.raw_user_meta_data->>'terms_accepted') = 'true'
        and (new.raw_user_meta_data->>'privacy_accepted') = 'true'
      then now()
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
