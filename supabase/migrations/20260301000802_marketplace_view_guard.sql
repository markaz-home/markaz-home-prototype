-- =============================================================================
-- MARKAZ Home — canonical migration 08.2: marketplace view publishable guard
-- A listing only becomes truly public when the atomic LIVE transition has set
-- its opaque public_id (and copied public photos). Require `public_id is not
-- null` so a LIVE row that predates publication (or is mid-transition) can never
-- surface in the marketplace with a null/broken public identity. Defence in
-- depth on top of the §4.4 publish gate.
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
where l.state = 'LIVE' and l.public_id is not null;

grant select on public.marketplace_listings to anon, authenticated;
