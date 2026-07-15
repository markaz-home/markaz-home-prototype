-- =============================================================================
-- MARKAZ Home — canonical migration 08.1: public marketplace view (Week 3)
-- The marketplace's ONLY public data source. A security-barrier view that
-- pre-projects the §37 allowlist for LIVE listings — it excludes the unit
-- identifier, occupancy, owner id, ownership docs, and any private storage path.
-- Anonymous + authenticated roles read this view; they never read the raw
-- properties / property_photos / investment_cases tables for marketplace data
-- (ADR-0013). Photo arrays carry only PUBLIC paths.
-- =============================================================================

create or replace view public.marketplace_listings
with (security_barrier = true) as
select
  l.public_id                           as public_id,
  l.public_slug                         as public_slug,
  l.state::text                         as state,
  l.asking_price                        as asking_price,
  l.description                         as description,
  l.published_at                        as published_at,
  l.public_updated_at                   as public_updated_at,
  p.property_type                       as property_type,
  p.emirate                             as emirate,
  p.community                           as community,
  p.building_or_project                 as building_or_project,
  p.bedrooms                            as bedrooms,
  p.bathrooms                           as bathrooms,
  p.size_sqft                           as size_sqft,
  p.furnishing_status                   as furnishing_status,
  p.completion_status                   as completion_status,
  p.parking_spaces                      as parking_spaces,
  p.features                            as features,
  coalesce(ic.visible, false)           as ic_visible,
  ic.estimated_roi_pct                  as ic_roi,
  ic.estimated_annualised_return_pct    as ic_annualised,
  ic.price_per_sqft                     as ic_price_per_sqft,
  (select pp.public_path from public.property_photos pp
     where pp.listing_id = l.id and pp.is_cover and pp.public_path is not null limit 1) as cover_public_path,
  coalesce((select array_agg(pp.public_path order by pp.sort_order)
     from public.property_photos pp
     where pp.listing_id = l.id and pp.public_path is not null), '{}') as photo_public_paths
from public.listings l
join public.properties p on p.id = l.property_id
left join public.investment_cases ic on ic.listing_id = l.id
where l.state = 'LIVE';

-- The view runs with its (postgres) owner's privileges, so RLS on the base
-- tables is bypassed — but it only ever exposes LIVE rows + public columns.
grant select on public.marketplace_listings to anon, authenticated;
