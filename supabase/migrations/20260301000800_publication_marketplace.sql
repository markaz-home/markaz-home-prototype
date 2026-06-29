-- =============================================================================
-- MARKAZ Home — canonical migration 08: publication + customer marketplace (Week 3)
-- Adds the publication-request record (separate from the listing state), public
-- URL identity (opaque public_id + slug), public photo references, the public
-- listing-photos read policy, and marketplace query indexes. Forward-only.
-- Listing state enum is unchanged (READY_TO_PUBLISH / LIVE / PAUSED used here).
-- =============================================================================

-- --- Publication-request status (separate enum; design spec §4.2) -----------
do $$ begin
  create type publication_request_status as enum
    ('NOT_SUBMITTED','PENDING','APPROVED_DEMO','REJECTED_DEMO');
exception when duplicate_object then null; end $$;

-- --- listings: public identity + publication/pause bookkeeping ----------------
alter table public.listings
  add column if not exists public_id           text,
  add column if not exists public_slug         text,
  add column if not exists paused_at           timestamptz,
  add column if not exists public_updated_at   timestamptz,
  add column if not exists publication_version integer not null default 1;

create unique index if not exists listings_public_id_key on public.listings (public_id) where (public_id is not null);
-- Marketplace sort/filter support.
create index if not exists listings_published_at_idx on public.listings (published_at desc) where (state = 'LIVE');
create index if not exists listings_asking_price_idx on public.listings (asking_price) where (state = 'LIVE');

-- --- property_photos: public copy reference ----------------------------------
alter table public.property_photos
  add column if not exists public_path text;   -- opaque path in the PUBLIC bucket

-- --- properties: marketplace filter indexes ----------------------------------
create index if not exists properties_type_idx      on public.properties (property_type);
create index if not exists properties_community_idx on public.properties (community);
create index if not exists properties_bedrooms_idx  on public.properties (bedrooms);
create index if not exists properties_emirate_idx   on public.properties (emirate);

-- --- listing_publication_requests --------------------------------------------
create table if not exists public.listing_publication_requests (
  id               uuid primary key default gen_random_uuid(),
  listing_id       uuid not null references public.listings(id) on delete cascade,
  seller_user_id   uuid references public.profiles(id) on delete set null,
  status           publication_request_status not null default 'NOT_SUBMITTED',
  outcome_category text,                          -- safe category only (§5.3); never raw notes
  submitted_at     timestamptz,
  resolved_at      timestamptz,
  superseded_at    timestamptz,                   -- set when a newer attempt replaces this one
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
-- At most one CURRENT (non-superseded) request per listing.
create unique index if not exists publication_requests_one_active
  on public.listing_publication_requests (listing_id) where (superseded_at is null);
create index if not exists publication_requests_listing_idx on public.listing_publication_requests (listing_id);
create index if not exists publication_requests_status_idx on public.listing_publication_requests (status);

alter table public.listing_publication_requests enable row level security;
alter table public.listing_publication_requests force row level security;

-- Owner of the listing reads/writes their own requests; admin reads all.
drop policy if exists publication_requests_owner on public.listing_publication_requests;
create policy publication_requests_owner on public.listing_publication_requests for all
  using (exists (select 1 from public.listings l where l.id = listing_publication_requests.listing_id and l.owner_id = auth.uid()))
  with check (exists (select 1 from public.listings l where l.id = listing_publication_requests.listing_id and l.owner_id = auth.uid()));
drop policy if exists publication_requests_admin on public.listing_publication_requests;
create policy publication_requests_admin on public.listing_publication_requests for all
  using (public.is_admin()) with check (public.is_admin());

grant select, insert, update, delete on public.listing_publication_requests to authenticated;

-- --- updated_at triggers ------------------------------------------------------
drop trigger if exists set_updated_at on public.listing_publication_requests;
create trigger set_updated_at before update on public.listing_publication_requests
  for each row execute function public.set_updated_at();

-- --- Public listing-photos bucket read policy --------------------------------
-- The public bucket was created in migration 04 but had no policy. Published
-- photos are copied here (opaque paths) and served as PUBLIC objects — anyone may
-- read; only the owner (or admin) writes/cleans up. Draft photos + ownership docs
-- stay in their PRIVATE buckets and are never copied here (ADR-0012).
drop policy if exists listing_photos_public_read on storage.objects;
create policy listing_photos_public_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'listing-photos');

drop policy if exists listing_photos_owner_write on storage.objects;
create policy listing_photos_owner_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'listing-photos' and (owner = auth.uid() or public.is_admin()));

drop policy if exists listing_photos_owner_modify on storage.objects;
create policy listing_photos_owner_modify on storage.objects
  for update to authenticated
  using (bucket_id = 'listing-photos' and (owner = auth.uid() or public.is_admin()));

drop policy if exists listing_photos_owner_delete on storage.objects;
create policy listing_photos_owner_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'listing-photos' and (owner = auth.uid() or public.is_admin()));
