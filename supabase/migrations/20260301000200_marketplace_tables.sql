-- =============================================================================
-- MARKAZ Home — canonical migration 02: foundational marketplace tables
-- Week 1: only the fields needed to establish relationships, ownership, and
-- state compatibility for the next milestone. No marketplace UI is built yet.
-- =============================================================================

-- --- State-machine enums (mirror packages/domain) ---------------------------
do $$ begin
  create type public.listing_state as enum (
    'DRAFT','DETAILS_COMPLETE','DOCUMENT_UPLOADED','OWNERSHIP_REVIEW',
    'OWNERSHIP_VERIFIED','FORM_A_COMPLETE','PHOTOS_COMPLETE','PERMIT_PENDING',
    'READY_TO_PUBLISH','LIVE','PAUSED','REJECTED','SOLD_DEMO');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.offer_state as enum (
    'DRAFT','SUBMITTED','UNDER_REVIEW','COUNTERED','ACCEPTED_AS_PREFERRED',
    'REJECTED','EXPIRED','WITHDRAWN');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.transaction_stage as enum (
    'OFFER','ACCEPTANCE','MOU','DEPOSIT','NOC','TRANSFER','HANDOVER','COMPLETE_DEMO');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.verification_status as enum
    ('PENDING','VERIFIED_DEMO','FAILED_DEMO');
exception when duplicate_object then null; end $$;

-- --- Properties --------------------------------------------------------------
create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  emirate text not null default 'Dubai',
  community text,
  address_line text,
  property_type text,
  bedrooms integer,
  size_sqft numeric(10,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists properties_owner_idx on public.properties (owner_id);

-- --- Listings ----------------------------------------------------------------
create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references public.properties (id) on delete set null,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  state public.listing_state not null default 'DRAFT',
  currency text not null default 'AED',
  asking_price numeric(14,2),
  min_notification_price numeric(14,2),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists listings_owner_idx on public.listings (owner_id);
create index if not exists listings_state_idx on public.listings (state);
create index if not exists listings_live_idx on public.listings (state) where state = 'LIVE';

-- --- Ownership documents (PRIVATE) ------------------------------------------
create table if not exists public.ownership_documents (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  document_type text not null,
  storage_path text not null,
  status public.verification_status not null default 'PENDING',
  created_at timestamptz not null default now()
);
create index if not exists ownership_docs_listing_idx on public.ownership_documents (listing_id);
create index if not exists ownership_docs_owner_idx on public.ownership_documents (owner_id);

-- --- Verifications / Form A / Permits ----------------------------------------
create table if not exists public.verifications (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  kind text not null,
  status public.verification_status not null default 'PENDING',
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists verifications_listing_idx on public.verifications (listing_id);

create table if not exists public.form_a_records (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  status public.verification_status not null default 'PENDING',
  signed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.permit_records (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  permit_type text not null default 'TRAKHEESI',
  permit_number text,
  status public.verification_status not null default 'PENDING',
  created_at timestamptz not null default now()
);

-- --- Property photos (PUBLIC delivery) --------------------------------------
create table if not exists public.property_photos (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  storage_path text not null,
  is_cover boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists property_photos_listing_idx on public.property_photos (listing_id);

-- --- Saved items -------------------------------------------------------------
create table if not exists public.saved_properties (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (customer_id, listing_id)
);
create index if not exists saved_properties_customer_idx on public.saved_properties (customer_id);

create table if not exists public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id) on delete cascade,
  label text,
  query jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists saved_searches_customer_idx on public.saved_searches (customer_id);

-- --- Offers / counter-offers -------------------------------------------------
create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete cascade,
  amount numeric(14,2) not null,
  state public.offer_state not null default 'SUBMITTED',
  below_threshold boolean not null default false,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- §6A.6: a customer can never offer on a listing they own.
  constraint offers_amount_positive check (amount > 0)
);
create index if not exists offers_listing_idx on public.offers (listing_id);
create index if not exists offers_created_by_idx on public.offers (created_by);

create table if not exists public.counter_offers (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.offers (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete cascade,
  amount numeric(14,2) not null,
  created_at timestamptz not null default now()
);
create index if not exists counter_offers_offer_idx on public.counter_offers (offer_id);

-- --- Transactions ------------------------------------------------------------
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid references public.offers (id) on delete set null,
  listing_id uuid not null references public.listings (id) on delete cascade,
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  seller_id uuid not null references public.profiles (id) on delete cascade,
  stage public.transaction_stage not null default 'ACCEPTANCE',
  flagged boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists transactions_buyer_idx on public.transactions (buyer_id);
create index if not exists transactions_seller_idx on public.transactions (seller_id);

create table if not exists public.transaction_stage_history (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions (id) on delete cascade,
  stage public.transaction_stage not null,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists tx_stage_history_tx_idx on public.transaction_stage_history (transaction_id);

-- --- Notifications / audit ---------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  channel text not null default 'IN_APP',
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_recipient_idx on public.notifications (recipient_id);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_events_entity_idx on public.audit_events (entity_type, entity_id);

-- updated_at triggers
drop trigger if exists properties_set_updated_at on public.properties;
create trigger properties_set_updated_at before update on public.properties
  for each row execute function public.set_updated_at();
drop trigger if exists listings_set_updated_at on public.listings;
create trigger listings_set_updated_at before update on public.listings
  for each row execute function public.set_updated_at();
drop trigger if exists offers_set_updated_at on public.offers;
create trigger offers_set_updated_at before update on public.offers
  for each row execute function public.set_updated_at();
drop trigger if exists transactions_set_updated_at on public.transactions;
create trigger transactions_set_updated_at before update on public.transactions
  for each row execute function public.set_updated_at();
