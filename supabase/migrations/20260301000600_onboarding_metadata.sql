-- =============================================================================
-- MARKAZ Home — canonical migration 06: onboarding metadata (Week 1.5, ADR-0009)
-- Email/password sign-up collects full name + consent up front, passed through
-- Supabase Auth user_metadata. The profile-creation trigger now hydrates the
-- profile from that metadata so the normal path skips the profile-setup screen.
-- Forward-only; RLS unchanged.
-- =============================================================================

-- Records when the customer finished onboarding (profile + identity). Nullable.
alter table public.profiles
  add column if not exists onboarding_completed_at timestamptz;

-- Hydrate full_name + consent timestamps from auth user_metadata on signup.
-- Still SECURITY DEFINER, idempotent, CUSTOMER-default. Public sign-up can never
-- create an ADMIN (account_type is hard-coded here, not taken from metadata).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id, email, full_name, account_type, identity_verification_status,
    terms_accepted_at, privacy_accepted_at
  )
  values (
    new.id,
    new.email,
    nullif(btrim(new.raw_user_meta_data->>'full_name'), ''),
    'CUSTOMER',
    'NOT_STARTED',
    case when (new.raw_user_meta_data->>'terms_accepted') = 'true' then now() end,
    case when (new.raw_user_meta_data->>'privacy_accepted') = 'true' then now() end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
