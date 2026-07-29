-- Public permit verification, as the Madmoun QR on a Dubai advert works: scanning
-- the code opens a page that confirms the advertising permit is valid. The permit
-- record itself is owner/admin-only under RLS, so verification runs through a
-- SECURITY DEFINER function returning an explicit, public-safe projection.
--
-- PRIVACY: `properties.unit_identifier` is private and never public (schema.ts,
-- marketplace view §37 allowlist), so it is NOT returned here — a permit page is
-- public and would otherwise leak the unit of every advertised property.
--
-- Permit numbers are case-insensitive references. Only one active record may
-- own a normalized number, which makes lookup deterministic and index-backed.
create unique index if not exists permit_active_number_uidx
  on public.permit_records ((upper(btrim(permit_number))))
  where permit_number is not null and superseded_at is null;

create or replace function public.permit_verification(p_permit_number text)
returns table (
  permit_number text,
  status text,
  approved_at timestamptz,
  property_type text,
  community text,
  building_or_project text,
  emirate text,
  listing_public_id text,
  listing_slug text,
  listing_is_live boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select
    pr.permit_number,
    pr.status::text,
    pr.approved_at,
    -- A valid permit may exist before its advert is public. Confirm validity,
    -- but do not disclose the unpublished property's metadata.
    case when l.state = 'LIVE' then p.property_type::text end,
    case when l.state = 'LIVE' then p.community end,
    case when l.state = 'LIVE' then p.building_or_project end,
    case when l.state = 'LIVE' then p.emirate::text end,
    case when l.state = 'LIVE' then l.public_id end,
    case when l.state = 'LIVE' then l.public_slug end,
    (l.state = 'LIVE')
  from public.permit_records pr
  join public.listings l on l.id = pr.listing_id
  left join public.properties p on p.id = l.property_id
  where char_length(btrim(p_permit_number)) between 3 and 64
    and pr.permit_number is not null
    and upper(btrim(pr.permit_number)) = upper(btrim(p_permit_number))
    -- Only an approved permit verifies; pending/failed records are not disclosed.
    and pr.status = 'VERIFIED_DEMO'
    and pr.superseded_at is null
  limit 1;
$$;

revoke all on function public.permit_verification(text) from public;
grant execute on function public.permit_verification(text) to anon, authenticated;
