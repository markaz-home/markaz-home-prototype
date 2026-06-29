# Customer Marketplace

See **ADR-0013** for the anonymous-access decision and
`public-listing-projection.md` for the privacy boundary.

The customer-facing marketplace (design spec §19–§30) lets **anonymous** visitors
and signed-in customers browse, search, filter, sort, and save `LIVE` listings. It
reads **only** the `marketplace_listings` security-barrier view via the
`publicTxProcedure` (anon-or-authed RLS).

## Routes (§11, §19)

| Route | Access | Purpose |
| --- | --- | --- |
| `/[locale]/properties` | anon or authed | browse grid + filters + pagination |
| `/[locale]/properties/[publicId]/[slug]` | anon or authed | public detail page |
| `/[locale]/saved-properties` | customer-only | saved available/unavailable list |

The `(public)` route group has **no auth guard**; its `MarketplaceHeader` adapts to
the session (public links + Sign in / List property vs the authenticated customer
nav + account menu). The slug is **cosmetic** — lookups use the opaque `publicId`.

## Query params + the shared schema

`marketplaceQuerySchema` (`packages/domain/src/marketplace.ts`) is shared by the
URL-state UI and the server query so validation mirrors. Params:

- `q` (free text, ≤100), `type`, `emirate`, `area`, `minPrice`/`maxPrice`,
  `beds` (`studio`/`1`…`5`), `baths` (`1`…`4`), `minSize`/`maxSize`, `furnishing`,
  `completion`, `investmentCase` (bool), `sort`, `page`.
- Coerced from strings; **range refinements** keep `minPrice ≤ maxPrice` and
  `minSize ≤ maxSize`.
- `parseMarketplaceQuery` is **lenient**: an individually-invalid field is dropped
  (§10.3 "unknown values ignored/normalised") rather than failing the whole query,
  but range errors are kept so the UI can surface them. `sort` and `page` fall back
  via `.catch()` (`NEWEST`, `1`).

Filters map to SQL over the view in `buildConditions` (marketplace router):
`q` is an `ilike` across community/emirate/building/type; `beds === 'studio'` →
`bedrooms = 0`, otherwise `bedrooms >= n`; `investmentCase` → `ic_visible = true`.

## Sorts (§22)

`NEWEST` (default, `published_at desc`), `PRICE_ASC`, `PRICE_DESC`, `SIZE_DESC`.
Every sort appends `asc(public_id)` as a **stable tiebreak** so pagination is
deterministic.

## Pagination (24/page)

`MARKETPLACE_PAGE_SIZE = 24`. `paginate(total, page)` clamps `page` into
`[1, totalPages]` and returns `{ page, pageSize, total, totalPages, hasPrev,
hasNext }`. The router runs a `count(*)` then a `limit/offset` page. In the UI
(`marketplace-browse.tsx`) **changing any filter or the sort resets the page**
(`update(patch, resetPage = true)` deletes `page` unless the patch is itself a page
change); the prev/next buttons pass `resetPage = false`. The list query uses
`placeholderData: (prev) => prev` so the grid does not blank between pages.

## Router surface (view-backed)

`marketplace` router (`packages/api/src/routers/marketplace.ts`):

- **`search`** (`publicTxProcedure`) — paginated `toPublicCard[]` + `pagination`.
- **`getByPublicId`** (`publicTxProcedure`) — `toPublicDetail` by opaque id, or
  **`null`** (unified unavailable state, anti-enumeration). Adds owner-only
  `isOwner` / `manageListingId` **outside** the projection when a session owns it.
- **`getFilterOptions`** (`publicTxProcedure`) — distinct emirates / communities /
  property types from the LIVE view, for filter menus.
- **`myLivePublicIds`** (`customerProcedure`) — the viewer's own LIVE public ids,
  so the grid badges "Your listing".
- **`saved.*`** (`customerProcedure`): `save` (idempotent; LIVE only; **owner cannot
  save own** → `BAD_REQUEST`), `remove`, `removeById`, `publicIds` (heart state),
  `isSaved`, and `list` (LIVE saves → cards; everything else → safe **unavailable**
  stubs, §29).

All reads go through the `marketplace_listings` view; `saved.*` joins back to
`listings` only to resolve ownership/state for the current customer.

## Adaptive header (§11)

`MarketplaceHeader` is a client component driven by `isAuthenticated` /
`displayName` from `getSession()` in the `(public)` layout. Anonymous: Browse / How
it works / For sellers + Sign in + List property. Authenticated: Dashboard / Browse
/ Saved / My listings + account dropdown. Mobile collapses to a disclosure menu.

## Anonymous save interception (§27, §28)

When a signed-out visitor taps **Save** (`SaveButton`):

1. `storeSaveIntent` writes a **short-lived, client-only** intent to `sessionStorage`
   (`save-intent.ts`): `{ action: 'SAVE_PROPERTY', publicId, returnPath, locale,
   expiresAt }`, TTL 30 min. The `returnPath` is **allow-listed** to
   `/{locale}/properties/{publicId}[/...]` (no open redirect); the intent never
   travels to the server and holds no credentials.
2. A dialog offers **Sign in** / **Create account** / **Continue browsing**.
3. After auth the visitor lands in the app shell; `SaveIntentRedirect` reads the
   intent and **hard-navigates** back to the property page (fresh authenticated
   session), where the save completes **idempotently**.

If `sessionStorage` is unavailable the interception degrades to a plain sign-in.
The save itself is **optimistic** in the UI and reverts on error; the server is the
source of truth.
</content>
