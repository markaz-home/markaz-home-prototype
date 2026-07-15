-- =============================================================================
-- MARKAZ Home — canonical migration 07: property-listing journey (Week 2)
-- Extends the marketplace foundation with the fields, investment-case table,
-- record freshness/outcome columns, a one-cover constraint, a PRIVATE draft
-- photo bucket (ADR-0011), and supporting indexes. Forward-only. RLS unchanged
-- for existing tables (owner-scoped policies already cover the new columns).
-- =============================================================================

-- --- properties: full Property Details field set (§12) -----------------------
alter table public.properties
  add column if not exists building_or_project text,
  add column if not exists unit_identifier   text,                       -- PRIVATE (never public)
  add column if not exists bathrooms          integer,
  add column if not exists furnishing_status  text,
  add column if not exists occupancy_status   text,                      -- PRIVATE by default
  add column if not exists completion_status  text,
  add column if not exists parking_spaces     integer,
  add column if not exists features           text[] not null default '{}';

do $$ begin
  alter table public.properties
    add constraint properties_furnishing_chk
      check (furnishing_status is null or furnishing_status in ('UNFURNISHED','PARTLY_FURNISHED','FURNISHED'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.properties
    add constraint properties_occupancy_chk
      check (occupancy_status is null or occupancy_status in ('VACANT','OWNER_OCCUPIED','TENANT_OCCUPIED'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.properties
    add constraint properties_completion_chk
      check (completion_status is null or completion_status in ('READY','OFF_PLAN'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.properties
    add constraint properties_bathrooms_chk check (bathrooms is null or (bathrooms between 1 and 10));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.properties
    add constraint properties_parking_chk check (parking_spaces is null or (parking_spaces between 0 and 10));
exception when duplicate_object then null; end $$;

create index if not exists properties_owner_idx on public.properties (owner_id);

-- --- listings: wizard resume + presentation + concurrency --------------------
alter table public.listings
  add column if not exists current_step            text,
  add column if not exists description             text,
  add column if not exists investment_case_visible boolean not null default false,
  add column if not exists investment_case_skipped boolean not null default false,
  add column if not exists review_confirmed_at     timestamptz,
  add column if not exists version                 integer not null default 1;

-- --- verifications: outcome + freshness --------------------------------------
alter table public.verifications
  add column if not exists failure_reason text,                          -- safe category only
  add column if not exists superseded_at  timestamptz,                   -- set when invalidated (ADR-0010)
  add column if not exists updated_at      timestamptz not null default now();
create index if not exists verifications_listing_idx on public.verifications (listing_id);

-- --- form_a_records: confirmation detail + freshness -------------------------
alter table public.form_a_records
  add column if not exists confirmed_by                    uuid references public.profiles(id) on delete set null,
  add column if not exists listing_price_at_confirmation   numeric(14,2),
  add column if not exists superseded_at                   timestamptz,
  add column if not exists updated_at                      timestamptz not null default now();
create index if not exists form_a_listing_idx on public.form_a_records (listing_id);

-- --- permit_records: approval + outcome + freshness --------------------------
alter table public.permit_records
  add column if not exists approved_at    timestamptz,
  add column if not exists failure_reason text,                          -- safe category only
  add column if not exists superseded_at  timestamptz,
  add column if not exists updated_at      timestamptz not null default now();
create index if not exists permit_listing_idx on public.permit_records (listing_id);

-- --- property_photos: metadata + ordering + exactly-one-cover ----------------
alter table public.property_photos
  add column if not exists original_name text,
  add column if not exists content_type  text,
  add column if not exists size_bytes    integer,
  add column if not exists width         integer,
  add column if not exists height        integer,
  add column if not exists updated_at    timestamptz not null default now();
-- At most one cover photo per listing.
create unique index if not exists property_photos_one_cover
  on public.property_photos (listing_id) where (is_cover);
create index if not exists property_photos_listing_order_idx
  on public.property_photos (listing_id, sort_order);

-- --- ownership_documents: one active doc, metadata, freshness ----------------
alter table public.ownership_documents
  add column if not exists original_name text,
  add column if not exists content_type  text,
  add column if not exists size_bytes    integer,
  add column if not exists active        boolean not null default true,
  add column if not exists updated_at    timestamptz not null default now();
do $$ begin
  alter table public.ownership_documents
    add constraint ownership_docs_type_chk check (document_type in ('TITLE_DEED','OQOOD'));
exception when duplicate_object then null; end $$;
-- At most one active ownership document per listing.
create unique index if not exists ownership_docs_one_active
  on public.ownership_documents (listing_id) where (active);
create index if not exists ownership_docs_listing_idx on public.ownership_documents (listing_id);

-- --- investment_cases (optional, 1:1 with a listing) ------------------------
create table if not exists public.investment_cases (
  id                              uuid primary key default gen_random_uuid(),
  listing_id                      uuid not null unique references public.listings(id) on delete cascade,
  original_purchase_price         numeric(14,2) not null,
  purchase_date                   date,
  renovation_costs                numeric(14,2) not null default 0,
  -- Server-computed trusted values (never trust client calculations):
  total_invested                  numeric(14,2),
  estimated_gain                  numeric(14,2),
  estimated_roi_pct               numeric(7,1),
  estimated_annualised_return_pct numeric(7,1),
  price_per_sqft                  numeric(14,2),
  visible                         boolean not null default false,
  created_at                      timestamptz not null default now(),
  updated_at                      timestamptz not null default now()
);
create index if not exists investment_cases_listing_idx on public.investment_cases (listing_id);

alter table public.investment_cases enable row level security;
alter table public.investment_cases force row level security;

drop policy if exists investment_cases_owner on public.investment_cases;
create policy investment_cases_owner on public.investment_cases for all
  using (exists (select 1 from public.listings l where l.id = investment_cases.listing_id and l.owner_id = auth.uid()))
  with check (exists (select 1 from public.listings l where l.id = investment_cases.listing_id and l.owner_id = auth.uid()));
drop policy if exists investment_cases_admin on public.investment_cases;
create policy investment_cases_admin on public.investment_cases for all
  using (public.is_admin()) with check (public.is_admin());

grant select, insert, update, delete on public.investment_cases to authenticated;

-- --- updated_at triggers for tables that gained updated_at -------------------
do $$
declare t text;
begin
  foreach t in array array['verifications','form_a_records','permit_records',
                           'property_photos','ownership_documents','investment_cases'] loop
    execute format('drop trigger if exists set_updated_at on public.%I;', t);
    execute format('create trigger set_updated_at before update on public.%I
                    for each row execute function public.set_updated_at();', t);
  end loop;
end $$;

-- --- PRIVATE draft-photo bucket (ADR-0011) ----------------------------------
-- Draft listing photos must NOT be publicly reachable before publication. They
-- live in a private bucket and are delivered via short-lived signed URLs. The
-- existing public `listing-photos` bucket is reserved for a future publication
-- milestone (copy-on-publish), which keeps the storage-boundary proof intact.
insert into storage.buckets (id, name, public)
values ('listing-photos-draft', 'listing-photos-draft', false)
on conflict (id) do update set public = excluded.public;

drop policy if exists listing_photos_draft_owner_rw on storage.objects;
create policy listing_photos_draft_owner_rw on storage.objects
  for all to authenticated
  using (bucket_id = 'listing-photos-draft' and (owner = auth.uid() or public.is_admin()))
  with check (bucket_id = 'listing-photos-draft' and owner = auth.uid());
