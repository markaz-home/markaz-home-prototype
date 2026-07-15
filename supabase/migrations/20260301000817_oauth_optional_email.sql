-- =============================================================================
-- MARKAZ Home — canonical migration 08.17: tolerate email-less OAuth identities
--
-- OAuth logins (e.g. the UAE PASS Staging POC via the Supabase custom provider)
-- can produce an `auth.users` row with NO email — UAE PASS returns an email only
-- for some account levels, and a tester may authenticate by mobile/EID. The
-- `handle_new_user` trigger inserted `new.email` straight into `public.profiles`,
-- whose `email` is NOT NULL + unique, so account creation failed with
-- "Database error saving new user" and the OAuth callback bounced back with an error.
--
-- Fix: when the auth email is absent, fall back to a STABLE, clearly non-deliverable
-- sentinel derived from the user id (unique per user, so the unique index holds).
-- Email/password users always have `new.email`, so they are unaffected. When the
-- provider does return an email (attribute-mapped), it is used as before.
-- =============================================================================

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
    coalesce(nullif(btrim(new.email), ''), new.id::text || '@no-email.uaepass.invalid'),
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
