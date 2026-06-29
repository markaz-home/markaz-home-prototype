# ADR 0013: Anonymous + authenticated marketplace access (security-barrier view)

- **Status:** Accepted
- **Date:** 2026-06 (Week 3)

## Context

The Week 3 marketplace must let **anonymous** visitors *and* signed-in customers
read public listing data — cards, the detail page, filter facets — while exposing
**none** of the private data those listings carry. The base tables
(`properties`, `property_photos`, `investment_cases`) mix public and **private**
columns: the unit identifier, occupancy status, owner id, ownership documents,
private draft storage paths, and the private Investment Case inputs (purchase
price/date, renovation, total invested, gain). RLS protects the customer-scoped
journey, but the public read path needs a positively-defined public surface, not a
"trust we removed the private columns" filter. And it must work for `anon` without
ever using the service-role key (which is reserved for the narrow public-photo
copy, ADR-0012).

## Decision

1. **One public data source: the `marketplace_listings` security-barrier VIEW**
   (migrations `…0801` / `…0802`). It joins `listings`/`properties`/`investment_cases`
   and selects **only** allow-listed public columns for `state = 'LIVE'`. It exposes
   neither the unit identifier, occupancy, owner id, ownership docs, nor any private
   storage path; photo arrays carry **only** `public_path` values. `security_barrier
   = true` prevents predicate push-down from leaking rows. The view runs with its
   owner's privileges, so it is the **single** place the marketplace touches the base
   tables — resolvers never read raw `properties` / `property_photos` /
   `investment_cases` for marketplace data. `grant select` is to `anon` +
   `authenticated`.

2. **Publishable guard (migration 08.2):** the view requires
   `l.public_id is not null` in addition to `state = 'LIVE'`. A LIVE row that
   predates publication or is mid-transition (no opaque id, no copied photos) can
   never surface with a null/broken public identity — defence in depth on top of the
   §4.4 atomic-publish gate.

3. **Two-layer enforcement: view + explicit mappers.** The router maps view rows to
   the public response **only** through `toPublicCard` / `toPublicDetail`
   (`packages/api/src/public-projection.ts`) — **allow-list mapping**, building a
   fresh object field-by-field, **never** returning a DB row with private fields
   deleted. The view bounds what is *queryable*; the mappers bound what is *returned*
   (the §37 allowlist). Either layer alone would be safe; together a new private
   column cannot leak by accident.

4. **`publicTxProcedure` (`packages/api/src/trpc.ts`):** branches per request —
   `withUserContext` when a session is present, `withAnonContext` (role `anon`)
   otherwise — so the resolver always runs in an RLS-scoped transaction. Anonymous
   browsing needs **no** service-role key. Resolvers still filter LIVE explicitly
   (the view already enforces it; the explicit filter is belt-and-braces).

5. **Anti-enumeration:** lookups use the **opaque** `public_id` (`mkz-…`), not a
   sequential id. `getByPublicId` returns `null` for a missing / non-LIVE / paused id,
   which the UI renders as a single **unified "unavailable" state** — a paused
   listing is indistinguishable from a never-existing one. Owner-only fields
   (`isOwner`, `manageListingId`) are computed **outside** the projection, from the
   `listings` table under the viewer's own context, and added to the response after
   the public shape is built.

## Alternatives considered

- **Query base tables and strip private columns in code.** Rejected: a new private
  column silently leaks unless every projection is updated; "remove fields" is the
  fragile inverse of "allow fields".
- **Make the base tables publicly readable via RLS.** Rejected: it would expose
  private columns to `anon` and couples the public surface to row-level policy
  instead of an explicit projection.
- **Serve the marketplace from the service-role key.** Rejected: violates the hard
  rule against the service-role key on customer/public read paths; the view +
  `anon` RLS reads the public surface with no elevated key.

## Consequences

- The marketplace router (`search`, `getByPublicId`, `getFilterOptions`, `saved.*`)
  reads `marketplace_listings`; the view + mappers are the privacy boundary
  (`docs/architecture/public-listing-projection.md`).
- Anonymous and authenticated reads share one code path and one RLS-scoped tx.
- Privacy is covered by the publication→marketplace integration test (asserts no
  unit id, owner id, or draft path in any public response) and the projection's own
  allow-list mapper shape.
</content>
