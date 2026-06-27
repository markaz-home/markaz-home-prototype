-- =============================================================================
-- MARKAZ Home — version-controlled seed (runs AFTER canonical migrations).
-- All data is clearly fictional and safe to reset (`pnpm supabase:reset`).
--
-- Three accounts (§6A.6):
--   Customer A — seller in the connected scenario (CUSTOMER)
--   Customer B — buyer in the connected scenario  (CUSTOMER)
--   Admin      — operations portal                (ADMIN)
-- Both customers can buy AND sell. A customer can never offer on their own
-- listing (enforced by trigger + RLS) — the seeded offer is B -> A's listing.
-- =============================================================================

-- --- Auth users (OTP sign-in; passwords are unused placeholders) ------------
insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
   created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
   confirmation_token, recovery_token, email_change_token_new, email_change)
values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000000a',
   'authenticated', 'authenticated', 'customer-a@markaz.demo',
   crypt('demo-only-not-used', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{}', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000000b',
   'authenticated', 'authenticated', 'customer-b@markaz.demo',
   crypt('demo-only-not-used', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{}', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000ad',
   'authenticated', 'authenticated', 'admin@markaz.demo',
   crypt('demo-only-not-used', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{}', '', '', '', '')
on conflict (id) do nothing;

insert into auth.identities
  (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values
  (gen_random_uuid(), 'customer-a@markaz.demo', '00000000-0000-0000-0000-00000000000a',
   '{"sub":"00000000-0000-0000-0000-00000000000a","email":"customer-a@markaz.demo"}', 'email', now(), now(), now()),
  (gen_random_uuid(), 'customer-b@markaz.demo', '00000000-0000-0000-0000-00000000000b',
   '{"sub":"00000000-0000-0000-0000-00000000000b","email":"customer-b@markaz.demo"}', 'email', now(), now(), now()),
  (gen_random_uuid(), 'admin@markaz.demo', '00000000-0000-0000-0000-0000000000ad',
   '{"sub":"00000000-0000-0000-0000-0000000000ad","email":"admin@markaz.demo"}', 'email', now(), now(), now())
on conflict do nothing;

-- The on_auth_user_created trigger created CUSTOMER profiles. Finalise them.
-- Both demo customers are returning + VERIFIED_DEMO so they skip onboarding.
update public.profiles set
  full_name = 'Aisha Al Falasi (Demo Seller)',
  identity_verification_status = 'VERIFIED_DEMO',
  terms_accepted_at = now(), privacy_accepted_at = now()
where id = '00000000-0000-0000-0000-00000000000a';

update public.profiles set
  full_name = 'Bilal Haddad (Demo Buyer)',
  identity_verification_status = 'VERIFIED_DEMO',
  terms_accepted_at = now(), privacy_accepted_at = now()
where id = '00000000-0000-0000-0000-00000000000b';

-- Admin: privileged role change is allowed because seed runs as postgres.
update public.profiles set
  full_name = 'MARKAZ Operations (Demo Admin)',
  account_type = 'ADMIN',
  identity_verification_status = 'VERIFIED_DEMO',
  terms_accepted_at = now(), privacy_accepted_at = now()
where id = '00000000-0000-0000-0000-0000000000ad';

-- --- Properties (owned by Customer A) ---------------------------------------
insert into public.properties (id, owner_id, emirate, community, address_line, property_type, bedrooms, size_sqft)
values
  ('00000000-0000-0000-0000-0000000010a1', '00000000-0000-0000-0000-00000000000a', 'Dubai', 'Dubai Marina', 'Marina Gate, Tower 1', 'Apartment', 2, 1180.00),
  ('00000000-0000-0000-0000-0000000010a2', '00000000-0000-0000-0000-00000000000a', 'Dubai', 'Downtown Dubai', 'Burj Vista', 'Apartment', 1, 820.00),
  ('00000000-0000-0000-0000-0000000010a3', '00000000-0000-0000-0000-00000000000a', 'Dubai', 'Arabian Ranches', 'Palmera 2', 'Villa', 3, 2400.00)
on conflict (id) do nothing;

-- --- Listings ----------------------------------------------------------------
-- Two LIVE, one awaiting review (so the admin overview has non-zero metrics).
insert into public.listings (id, property_id, owner_id, title, state, currency, asking_price, min_notification_price, published_at)
values
  ('00000000-0000-0000-0000-0000000020a1', '00000000-0000-0000-0000-0000000010a1', '00000000-0000-0000-0000-00000000000a',
   'Bright 2-bed in Dubai Marina (Demo)', 'LIVE', 'AED', 2650000, 2400000, now()),
  ('00000000-0000-0000-0000-0000000020a2', '00000000-0000-0000-0000-0000000010a2', '00000000-0000-0000-0000-00000000000a',
   'Downtown 1-bed with Burj view (Demo)', 'LIVE', 'AED', 1950000, 1800000, now()),
  ('00000000-0000-0000-0000-0000000020a3', '00000000-0000-0000-0000-0000000010a3', '00000000-0000-0000-0000-00000000000a',
   'Arabian Ranches 3-bed villa (Demo)', 'OWNERSHIP_REVIEW', 'AED', 5200000, 4900000, null)
on conflict (id) do nothing;

insert into public.property_photos (id, listing_id, storage_path, is_cover, sort_order)
values
  ('00000000-0000-0000-0000-0000000030a1', '00000000-0000-0000-0000-0000000020a1', 'listing-photos/demo/marina-cover.jpg', true, 0),
  ('00000000-0000-0000-0000-0000000030a2', '00000000-0000-0000-0000-0000000020a2', 'listing-photos/demo/downtown-cover.jpg', true, 0)
on conflict (id) do nothing;

-- A private ownership document on the review listing (fictional sample path).
insert into public.ownership_documents (id, listing_id, owner_id, document_type, storage_path, status)
values
  ('00000000-0000-0000-0000-0000000040a1', '00000000-0000-0000-0000-0000000020a3', '00000000-0000-0000-0000-00000000000a',
   'TITLE_DEED', 'ownership-documents/demo/title-deed-sample.pdf', 'PENDING')
on conflict (id) do nothing;

-- --- Offer: Customer B offers on Customer A's LIVE listing -------------------
-- (A buyer offering on a seller's listing — never on their own.)
insert into public.offers (id, listing_id, created_by, amount, state, below_threshold, expires_at)
values
  ('00000000-0000-0000-0000-0000000050b1', '00000000-0000-0000-0000-0000000020a1', '00000000-0000-0000-0000-00000000000b',
   2500000, 'UNDER_REVIEW', false, now() + interval '48 hours'),
  -- A below-threshold offer (recorded, no seller notification).
  ('00000000-0000-0000-0000-0000000050b2', '00000000-0000-0000-0000-0000000020a2', '00000000-0000-0000-0000-00000000000b',
   1500000, 'SUBMITTED', true, now() + interval '48 hours')
on conflict (id) do nothing;

-- --- A transaction in progress + one completed (for admin metrics) ----------
insert into public.transactions (id, offer_id, listing_id, buyer_id, seller_id, stage, flagged)
values
  ('00000000-0000-0000-0000-0000000060c1', null, '00000000-0000-0000-0000-0000000020a2',
   '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000a', 'MOU', false)
on conflict (id) do nothing;

insert into public.transaction_stage_history (transaction_id, stage, note)
values ('00000000-0000-0000-0000-0000000060c1', 'ACCEPTANCE', 'Demo: offer accepted as preferred')
on conflict do nothing;

-- --- A couple of notifications for the dashboard ----------------------------
insert into public.notifications (recipient_id, channel, kind, payload)
values
  ('00000000-0000-0000-0000-00000000000a', 'IN_APP', 'OFFER_RECEIVED', '{"listing":"Dubai Marina"}'),
  ('00000000-0000-0000-0000-00000000000b', 'IN_APP', 'TRANSACTION_STAGE', '{"stage":"MOU"}')
on conflict do nothing;
