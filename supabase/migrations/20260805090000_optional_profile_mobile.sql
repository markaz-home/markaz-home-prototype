-- =============================================================================
-- MARKAZ Home — optional customer mobile contact details
--
-- A mobile number is profile contact information only. It is not a native
-- MARKAZ sign-in identifier and is never used to resolve a UAE PASS identity;
-- the provider subject in auth.identities remains the durable link.
-- =============================================================================

do $$ begin
  create type public.phone_verification_source as enum ('MARKAZ_OTP', 'UAE_PASS');
exception when duplicate_object then null; end $$;

alter table public.profiles
  add column if not exists phone_e164 text,
  add column if not exists phone_verified_at timestamptz,
  add column if not exists phone_verification_source public.phone_verification_source;

alter table public.profiles
  drop constraint if exists profiles_phone_e164_format,
  add constraint profiles_phone_e164_format
    check (phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  drop constraint if exists profiles_phone_verification_consistent,
  add constraint profiles_phone_verification_consistent
    check (
      (phone_verified_at is null and phone_verification_source is null)
      or
      (phone_e164 is not null and phone_verified_at is not null and phone_verification_source is not null)
    );

comment on column public.profiles.phone_e164 is
  'Optional E.164 contact mobile. Not a MARKAZ login identifier or UAE PASS linking key.';
comment on column public.profiles.phone_verified_at is
  'Null until a reviewed MARKAZ OTP or UAE PASS verification workflow confirms the stored number.';
comment on column public.profiles.phone_verification_source is
  'The reviewed workflow that verified the current phone_e164 value.';
