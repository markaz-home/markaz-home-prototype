# Public Listing Projection (the §37 privacy boundary)

See **ADR-0013** for the access decision. This document enumerates exactly what is
public and what is never public, and how the boundary is enforced twice.

A listing's base tables (`properties`, `property_photos`, `investment_cases`,
`listings`) mix public and **private** data. The marketplace must expose only the
design-spec **§37 allowlist**. The boundary is enforced in **two layers** — the
`marketplace_listings` view (what is *queryable*) and the explicit mappers (what is
*returned*).

## What IS public (the §37 allowlist)

Emitted by the `marketplace_listings` view (`…0801`/`…0802`) and the mappers
`toPublicCard` / `toPublicDetail` (`packages/api/src/public-projection.ts`):

**Identity / commercial**

- opaque `public_id` and cosmetic `public_slug`
- `state` (used only to confirm `LIVE` / build `isLive`)
- `asking_price` (AED), `description`
- `published_at`, `public_updated_at`
- a derived public **headline** (`buildHeadline`: e.g. "2-bedroom apartment in
  Marina Gate 2") — built from public fields only, never the stored owner title
  (which may contain the private unit identifier)

**Property facts**

- `property_type`, `emirate`, `community`, `building_or_project`
- `bedrooms`, `bathrooms`, `size_sqft`
- `furnishing_status`, `completion_status`, `parking_spaces`, `features[]`

**Photos**

- `cover_public_path` and `photo_public_paths[]` — **only** `public_path` values,
  resolved to **unsigned public-bucket URLs** (`publicPhotoUrl`)

**Investment Case — public METRICS only, and only when visible**

- `estimated_roi_pct`, `estimated_annualised_return_pct`, `price_per_sqft` — and
  only when `ic_visible = true` (cards expose just `investmentCaseAvailable`)

**Owner-only, added OUTSIDE the projection** (never for anonymous viewers): `isOwner`
and `manageListingId`, computed by the router from `listings` under the viewer's own
RLS context after the public shape is built.

## What is NEVER public

Excluded by the view (not selected) and never present in the mapper output:

- the **unit identifier** and **occupancy status**
- the **owner id** / seller email / phone / name; any internal UUID (`listings.id`,
  `property.id`)
- **ownership documents** and any **private storage path** (the draft bucket
  `listing-photos-draft`, document paths) or signed private URL
- **draft** (un-promoted) photos — only `public_path` rows appear
- verification / Form A / **permit** internals; **publication-request** internals
  (status, outcome category, timestamps); audit events
- the **private Investment Case inputs**: original purchase price, purchase date,
  renovation costs, total invested, estimated gain (§26.2) — only the three derived
  metrics above are ever public, and only when visible
- the `min_notification_price` and any other seller-only setting

The publication→marketplace integration test asserts a public detail response
contains no unit identifier, no owner id, and no `listing-photos-draft` path.

## Two-layer enforcement

1. **View (`marketplace_listings`, `security_barrier = true`).** Selects only the
   allow-listed columns for `state = 'LIVE' and public_id is not null`. Bounds what
   is **queryable** — resolvers cannot reach a private column because the view does
   not project it. `security_barrier` blocks predicate push-down leaks.
2. **Explicit mappers (`toPublicCard` / `toPublicDetail`).** Build a fresh response
   object **field-by-field** from the view row. **Allow-list mapping, never
   delete-fields-from-a-row** — there is no path where a base row is returned with
   private fields stripped, so a newly-added private column cannot leak by omission.

Either layer alone is safe; together a new private column on a base table is
inert until *both* the view and a mapper are deliberately extended to expose it.

## Why owner-only fields live outside the projection

`isOwner` / `manageListingId` are **viewer-relative**, not properties of the public
listing. Putting them in `toPublicDetail` would either compute owner state for every
(including anonymous) viewer or smuggle a private listing id into the public shape.
Instead the router computes them separately from `listings` under the viewer's own
context and appends them to the response — anonymous viewers get `isOwner = false`,
`manageListingId = null`, and the public projection stays purely public.
</content>
