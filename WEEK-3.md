# MARKAZ Home — Week 3 Delivery Report

**Milestone: Listing Publication + Customer-Facing Marketplace**

The seller-side publication journey (`READY_TO_PUBLISH → simulated review → atomic
`LIVE`) and the public, customer-facing marketplace are implemented: real,
persisted, secure, bilingual, and anonymous-or-authenticated. A listing only
becomes truly public when an **atomic LIVE transition** sets its opaque public id
and copies its photos to the public bucket; the marketplace reads exclusively
through a **security-barrier view** that pre-projects the §37 allowlist. Week 1 /
1.5 / 2 foundations are preserved (no auth redesign, RLS strategy intact,
Customer/Admin model intact, the `DRAFT → READY_TO_PUBLISH` wizard untouched).

Authoritative decision records: **ADR-0012** (public-photo pipeline) and
**ADR-0013** (anonymous marketplace access). UX governed by
`docs/design/publication-design-spec.md`. Architecture: `docs/architecture/
publication-flow.md`, `marketplace.md`, `public-listing-projection.md`.

## 1. What was built

- **Seller publication** (design spec §4, §5, §12–§18):
  - **Publication checklist + eligibility** (`packages/domain/src/publication.ts`,
    `listing.publication.checklist`) derived from the server-authoritative
    progress snapshot — never the client.
  - **Submit → simulated review → atomic LIVE** (`PublicationReviewService`):
    a **separate** `listing_publication_requests` record holds the review status,
    so a returned review never corrupts the listing journey. Resolve **re-validates
    the §4.4 gate**, prepares public photos all-or-nothing, then flips `LIVE`,
    sets the opaque `public_id`, slug, and `published_at` in **one transaction**.
  - **Pause / resume** (§18): a `LIVE` listing pauses out of the marketplace and
    resumes back to `LIVE`, re-validating readiness.
  - **Material vs non-material live edits** (§17.4): description / features /
    photo-order / cover / investment-visibility update in place while `LIVE`;
    everything else is **material** (default-to-material) and needs
    Pause → edit → republish.
- **Customer marketplace** (design spec §19–§30):
  - **Anonymous + authenticated** browse / search / filter / sort with **24-per-page**
    pagination (page resets on filter/sort change); a public **detail page** keyed
    by the opaque `public_id`; **save property**, **saved properties**, and
    **anonymous save interception** (§28).
- **Database** (forward-only migrations `…0800/0801/0802`): the publication-request
  table + status enum (separate from the listing enum), public identity columns,
  the public photo reference, the public `listing-photos` read policy, and the
  **`marketplace_listings`** security-barrier view (the sole public source).
- **API**: `marketplace` router (`publicTxProcedure`), publication procedures on
  the `listing` router, the `public-projection.ts` allowlist mappers, and the
  service-role-isolated public-photo pipeline (`packages/db/src/storage-admin.ts`).
- **Web UI** (`apps/web`): the `(public)` route group + adaptive header, browse
  grid, property card / detail / gallery, save button + intent redirect, saved
  properties, and the seller `publish` / `publication` / `manage` screens.
- **i18n**: marketplace / save / sort / publication namespaces (en + **ar draft,
  flagged**).
- **Seed**: Week-3 marketplace scenarios (below).

## 2. What was preserved

Turborepo/pnpm workspace, `apps/web` + separate `apps/admin`, canonical migrations,
Drizzle mirror, tRPC tiers + RLS context, Customer/Admin separation, email/password
auth, the `DRAFT → READY_TO_PUBLISH` listing wizard, draft-photo privacy (ADR-0011),
en/ar + RTL, `@markaz/ui`, Supabase local, realtime + storage foundations, demo
provisioning. No authentication or listing-wizard rework.

## 3. Route inventory (design spec §11, §19)

```
/[locale]/properties                                 marketplace (anon or authed)
/[locale]/properties/[publicId]/[slug]               public detail page
/[locale]/saved-properties                            saved (customer-only)
/[locale]/sell/listings/[id]/publish                  publication checklist + submit
/[locale]/sell/listings/[id]/publication              review status → LIVE
/[locale]/sell/listings/[id]/manage                   LIVE/PAUSED management
```

The `(public)` route group has **no auth guard** — anonymous visitors browse; the
header (`MarketplaceHeader`) adapts to the session when one exists. `saved-properties`
and the seller publication screens require an onboarded `CUSTOMER` and verify
ownership **server-side**; non-owners get the same safe "not available" copy
(anti-enumeration). The customer app still exposes **no** admin route.

## 4. Publication state machine (ADR-0012, publication-flow.md)

The listing enum is **unchanged** — Week 3 uses `READY_TO_PUBLISH`, `LIVE`,
`PAUSED`. Publication-review status lives in a **separate**
`listing_publication_requests` table (`NOT_SUBMITTED / PENDING / APPROVED_DEMO /
REJECTED_DEMO`) with a partial unique index allowing **one active (non-superseded)
request per listing**. Submit supersedes any prior request and creates a fresh
`PENDING` one (idempotent). Resolve **re-validates the §4.4 atomic-LIVE gate**
(state still `READY_TO_PUBLISH`, ≥1 photo, a cover, asking > 0, a non-superseded
`VERIFIED_DEMO` permit); on failure it returns `REJECTED_DEMO` with a **safe
category** (`CHECKLIST_INCOMPLETE` / `PHOTO_PROCESSING_FAILED` /
`DEMO_REVIEW_RETURNED`) and never moves the listing to `REJECTED`. On success it
performs the **atomic LIVE transition** in one transaction. The opaque `public_id`
is set once and preserved across re-publication.

## 5. Database changes (migrations 08 / 08.1 / 08.2) + RLS

- `listings +` `public_id` (partial-unique), `public_slug`, `paused_at`,
  `public_updated_at`, `publication_version`; LIVE-only sort/filter indexes on
  `published_at` / `asking_price`.
- `property_photos +` `public_path` (opaque path in the **public** bucket).
- `properties +` marketplace filter indexes (type / community / bedrooms / emirate).
- `listing_publication_requests` (new) — owner+admin RLS, the one-active partial
  unique index, `updated_at` trigger; `outcome_category` stores a **safe category
  only**, never raw notes.
- Storage: the public `listing-photos` bucket gets a **public read** policy
  (anon + authenticated) and owner/admin write/modify/delete; draft photos and
  ownership documents stay in their **private** buckets (ADR-0011/0012).
- `marketplace_listings` security-barrier **view** (08.1) re-defined in 08.2 to add
  the `public_id is not null` publishable guard; `grant select` to anon +
  authenticated.

## 6. Public-photo pipeline (ADR-0012)

On publish, `copyDraftPhotoToPublic` downloads each draft object from the **private**
`listing-photos-draft` bucket and uploads it to the **public** `listing-photos`
bucket at the opaque key `${publicId}/${photoId}`, recording `public_path`. This is
the **one** elevated, service-role-isolated operation in the system
(`packages/db/src/storage-admin.ts`) — every other customer-scoped storage operation
uses the customer's own RLS session. The copy is **all-or-nothing**: any failure
removes the prepared public objects, nulls every `public_path` for the listing, and
returns `PHOTO_PROCESSING_FAILED` — the listing never goes `LIVE` with a partial
photo set. Ownership documents are **never** touched.

## 7. Marketplace read path (ADR-0013)

The `marketplace_listings` **security-barrier view** is the **only** public data
source — anonymous and authenticated roles read it, never the raw
`properties` / `property_photos` / `investment_cases` tables (which carry private
columns). `publicTxProcedure` runs each resolver in an RLS-scoped transaction as
the authenticated user when present (`withUserContext`) or as `anon`
(`withAnonContext`) otherwise; resolvers still filter LIVE explicitly. The view's
columns are mapped to the public response **only** through the explicit allow-list
mappers `toPublicCard` / `toPublicDetail` (allow-list mapping, never
delete-fields-from-a-row). `getByPublicId` returns `null` for a missing/non-LIVE id
→ a **unified unavailable state** (anti-enumeration). Owner-only fields
(`isOwner` / `manageListingId`) are added **outside** the projection.

## 8. Saved properties (§20, §29, §30)

A customer saves another customer's `LIVE` property (idempotent); the **owner can
never save their own** (API + future RLS). The saved list renders LIVE saves as
public cards and everything else (paused/removed) as a **safe unavailable stub**
carrying no private data. Anonymous Save stores a **short-lived, client-only**
intent in `sessionStorage` (allow-listed to the public property path, no
credentials, no server round-trip), routes to sign-in, and completes the save
idempotently on return (`save-intent.ts` + `SaveIntentRedirect`).

## 9. Audit events

`LISTING_PUBLICATION_SUBMITTED`, `LISTING_PUBLICATION_RETURNED_DEMO`,
`LISTING_PUBLIC_PHOTOS_PREPARED`, `LISTING_PUBLIC_PHOTOS_FAILED`,
`LISTING_PUBLICATION_APPROVED_DEMO`, `LISTING_PUBLISHED`, `LISTING_PAUSED`,
`LISTING_RESUMED`, `PROPERTY_SAVED`, `PROPERTY_SAVE_REMOVED`. Safe metadata only
(IDs / categories / counts) — never raw review notes, storage paths, signed URLs,
or identity data.

## 10. Out of scope (next milestone+)

Offers / counter-offers UX, transactions UX, the admin portal / moderation surface,
payments, in-app messaging, map/geo search, durable job queues, and any AWS
provisioning. The publication review and the marketplace are **simulated /
read-only** — no real DLD/Trakheesi/payment integration; nothing here moves money
or makes an official/government/legal claim.

## 11. How to demo it

Reset + provision a clean local stack, then sign in:

```
pnpm supabase:reset && pnpm db:setup
# sign in as customer-a@markaz.demo  (password: Markaz!Demo1)
```

The seed (`packages/db/src/scripts/setup-demo.ts`) provisions:

- **3 LIVE listings** with public ids + public cover photos — two owned by
  Customer A (Marina, Downtown) and one owned by **Customer B** (JBR 3-bed, which
  carries a **visible Investment Case**).
- **1 PAUSED listing** (Customer B's Dubai Hills villa) — not in the marketplace.
- **Customer A's saved set**: one **available** (B's LIVE JBR) + one **unavailable**
  (B's PAUSED villa) — exercising the saved available/unavailable states.

Browse `/properties` signed-out to verify anonymous browse + the Save interception
dialog; sign in as Customer A to save B's listing and view `/saved-properties`;
sign in and drive one of your own `READY_TO_PUBLISH` listings through
`/sell/listings/[id]/publish` → `publication` → `manage` (pause/resume).

## 12. Tests & validation

Validated against a clean local stack (`pnpm supabase:reset && pnpm db:setup`).
The standard gate all passed for this milestone:

- `pnpm typecheck` — 12/12 packages clean.
- `pnpm lint` — 11/11 packages clean.
- `pnpm test` — unit + RLS/storage/integration suites green (domain **71** tests
  incl. the new marketplace suite; the integration suites incl.
  `publication-marketplace`).
- `pnpm build` — full monorepo build succeeds; all new routes register.
- `pnpm --filter @markaz/web exec playwright test e2e/marketplace.spec.ts` — **4/4
  pass** (browse, anonymous-save interception, authenticated saved, and an axe
  accessibility scan with **no critical/serious violations** on the browse page).

New tests of note:

- **Domain** (`packages/domain/src/__tests__/publication.test.ts`,
  `marketplace.test.ts`): checklist/eligibility, live-edit classification,
  pause/resume guards, slug/public-id formatting; the marketplace query schema,
  lenient URL parse, and pagination maths.
- **Integration** (`tests/integration/publication-marketplace.test.ts`, live
  stack): drives a `READY_TO_PUBLISH` listing to `LIVE` through the **real**
  publication review + public-photo pipeline, then asserts the anonymous
  marketplace exposes it, the public detail carries **no** unit id / owner id /
  draft path, pause hides it (and turns a save into an unavailable stub), resume
  re-exposes it, owner-cannot-save-own, and filters/sort over the view.
- **E2E** (`apps/web/e2e/marketplace.spec.ts`): anonymous browse/filter/open,
  the anonymous Save sign-in interception dialog, browse-page accessibility (axe),
  and the authenticated saved-properties available/unavailable states.

Existing Week 1 / 1.5 / 2 suites (auth, RLS, storage, listing journey/privacy,
provisioning) remain in place and are unaffected.

## 13. Known limitations

- **Arabic copy is a flagged draft** (`_meta.reviewRequired`); not legally reviewed.
- **Simulation timing** is resolve-on-poll (no durable job queue — out of scope):
  the PENDING request resolves when the status is next read.
- The public bucket serves objects by **public URL** (no signing) by design — this
  is correct for *published* photos only; draft photos and documents never enter it.
- Production server-side GoTrue password policy remains a platform follow-up
  (ADR-0009), unaffected here.

## 14. Acceptance status

- [x] Seller publication checklist + **server-authoritative eligibility**; submit
      for simulated review; never claims an official/government/legal review.
- [x] **Atomic LIVE transition** (§4.4): re-validated at resolve time; public id +
      slug + photos set in one transaction; `public_id is not null` view guard.
- [x] **All-or-nothing public-photo pipeline** (ADR-0012): failure cleans up +
      returns `PHOTO_PROCESSING_FAILED`; listing never partially public.
- [x] Returned review uses a **safe category**; the listing stays recoverable and
      never moves to `REJECTED`.
- [x] **Pause/resume** (§18); **material vs non-material live edits** (§17.4).
- [x] Anonymous + authenticated **browse / search / filter / sort**; **24-per-page**
      pagination; page resets on filter/sort change.
- [x] Public **detail page** by opaque id; **anti-enumeration** unified unavailable
      state for missing/non-LIVE ids.
- [x] **Save property** (idempotent; owner cannot save own); **saved properties**
      with available/unavailable states; **anonymous save interception** (§28).
- [x] Marketplace reads **only** the security-barrier view; the **§37 allowlist** is
      enforced by the view **and** the explicit mappers (ADR-0013).
- [x] Domain + integration + e2e tests cover publication, the public-photo pipeline,
      privacy, pause/resume, saves, and anonymous browse; en/ar/RTL; axe on browse.
- [x] No real sensitive data; no service-role key on any customer read path; the
      service-role key is used **only** in the narrow public-photo copy.

## 15. Readiness for the next milestone

The marketplace and publication pipeline are complete and secure. The public
projection, the LIVE-only view, and the opaque public id give offers/transactions a
stable, private-safe surface to build on. No further publication or marketplace
rework is needed for the next milestone.
</content>
</invoke>
