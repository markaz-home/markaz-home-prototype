# Publication Flow (READY_TO_PUBLISH → LIVE)

See **ADR-0012** (public-photo pipeline) and **ADR-0013** (marketplace access). UX:
`docs/design/publication-design-spec.md` §4, §5, §12–§18.

Week 3 takes a `READY_TO_PUBLISH` listing through a **simulated** publication review
to `LIVE`, then supports pause/resume and limited live edits. The listing state
enum is **unchanged** — only `READY_TO_PUBLISH`, `LIVE`, and `PAUSED` are used.

## Two state machines, kept separate

The **review** status lives in its own record so a returned review never corrupts
the listing journey (§5.1):

| Listing state (`listings.state`) | Publication-request status (`listing_publication_requests.status`) |
| --- | --- |
| `READY_TO_PUBLISH` → `LIVE` → `PAUSED` → `LIVE` | `NOT_SUBMITTED` → `PENDING` → `APPROVED_DEMO` / `REJECTED_DEMO` |

`publication.ts` (domain) defines the request-status enum and the safe
`PublicationResultCategory` set; the listing enum is untouched.

## listing_publication_requests (migration 08)

Separate table, `listing_id` FK, `status`, `outcome_category` (a **safe category
only** — never raw notes), `submitted_at` / `resolved_at` / `superseded_at`.

- **One active request per listing**: partial unique index
  `publication_requests_one_active … where (superseded_at is null)`.
- **RLS**: the listing owner reads/writes their own requests; admin reads all;
  `force row level security`; `updated_at` trigger.

## Submit (§5.2)

`listing.publication.submit` → `PublicationReviewService.submit`:

1. Re-checks `state === 'READY_TO_PUBLISH'` and **server-authoritative eligibility**
   (`isPublicationEligible` over the progress snapshot + asking price).
2. If a current request is already `PENDING`, returns it (**idempotent**).
3. Otherwise supersedes any prior current request and inserts a fresh `PENDING`
   one. Audit: `LISTING_PUBLICATION_SUBMITTED`.

The checklist (`publicationChecklist`, §13.2) derives item statuses
(`details / ownership / price / formA / photos / cover / permit / privacy /
investmentVisibility`) purely from `computeReadiness` + the asking price — the
client never decides eligibility.

## Resolve = the §4.4 LIVE gate (compensated, idempotent workflow)

`listing.publication.status` → `PublicationReviewService.resolve` re-validates at
**resolve time** (state may have drifted since submit). **Supabase Storage and
PostgreSQL do NOT participate in one cross-system transaction.** Public-photo
preparation and the database LIVE transition form an idempotent, compensated
publication workflow with two distinct phases:

1. **Re-validate**: state still `READY_TO_PUBLISH`, ≥1 photo, a cover photo,
   `asking_price > 0`, and a non-superseded permit with `status = 'VERIFIED_DEMO'`.
   Any miss → `REJECTED_DEMO` with category `CHECKLIST_INCOMPLETE` (a forced demo
   failure returns `DEMO_REVIEW_RETURNED`). The listing stays `READY_TO_PUBLISH` —
   it never moves to `REJECTED`.
2. **Fix stable identity**: an opaque `public_id` (`mkz-…`, set once at submit and
   preserved across re-publication) and a cosmetic public slug from public fields
   only. Fixing `public_id` at submit makes photo object keys deterministic, so a
   retry never creates duplicate public objects.
3. **Phase 1 — prepare public photos** (service role; compensable): copy each draft
   photo to the public bucket at the deterministic key `${publicId}/${photoId}`
   (upsert → idempotent); record `public_path` via `setPublicPhotoPath` (elevated
   `postgres` connection, outside the RLS transaction); verify every object exists.
   On any failure: compensate (`removePublicPhotos` + `clearPublicPhotoPaths`), keep
   the listing non-`LIVE`, return `REJECTED_DEMO` / `PHOTO_PROCESSING_FAILED`
   (retryable). See ADR-0012.
4. **Phase 2 — atomic database LIVE transition** (one PostgreSQL transaction): set
   `state = 'LIVE'`, `public_id`, `public_slug`, `published_at` (first time only),
   `public_updated_at`, `paused_at = null`, bump `publication_version`; mark the
   request `APPROVED_DEMO`. Audit: `LISTING_PUBLIC_PHOTOS_PREPARED`,
   `LISTING_PUBLICATION_APPROVED_DEMO`, `LISTING_PUBLISHED`. **The database
   transition to LIVE is atomic.**
5. **If Phase 2 fails after Phase 1 succeeded**: compensate (Storage cleanup), keep
   the listing non-`LIVE`, leave the request `PENDING` (retryable). A later retry
   re-copies to the same deterministic keys — no duplicate objects are created. A
   re-resolve after a successful LIVE transition is a no-op (the request is no longer
   `PENDING`).

Because the marketplace view additionally requires `public_id is not null` (migration
08.2), a listing that is mid-transition can never surface. The review never claims an
official/government/legal decision. Regulatory review is simulated. No real government,
legal, payment, or transaction integration is performed.

**Non-production fault-injection seams** (`PublicationFault`): `photoFailAt` (throw
while copying photo at a given index) and `dbTxFail` (throw before the atomic DB
transition) are available for compensation and retry tests; both are no-ops in
production.

## Returned review + retry

A `REJECTED_DEMO` request carries a safe `outcome_category`
(`CHECKLIST_INCOMPLETE` / `PHOTO_PROCESSING_FAILED` / `DEMO_REVIEW_RETURNED`). The
listing is fully recoverable; `listing.publication.retry` re-validates eligibility
and submits a fresh `PENDING` request. An invalidating edit calls
`supersedePending` so a stale review cannot later flip the listing live.

## Pause / resume (§18)

- **`pause`** (`canPause`: `LIVE`): set `PAUSED`, `paused_at = now`. The listing
  leaves the marketplace immediately (the view is `LIVE`-only); existing saves
  become safe **unavailable** stubs. Audit `LISTING_PAUSED`.
- **`resume`** (`canResume`: `PAUSED`): re-validates eligibility, then back to
  `LIVE`, `paused_at = null`, refresh `public_updated_at`. If readiness no longer
  holds, resume is refused with a "needs publication review" message
  (`resumeRequiresReview`, §18.3). Audit `LISTING_RESUMED`.

## Material vs non-material live edits (§17.4)

`classifyLiveEdit(field)` (domain) — **default-to-MATERIAL** is the safe choice.

- **Non-material** (`NON_MATERIAL_FIELDS`): `description`, `features`, `photoOrder`,
  `cover`, `investmentVisibility`. `listing.applyNonMaterialEdit` updates them in
  place on a `LIVE` listing and refreshes `public_updated_at` — the listing stays
  live, no re-review.
- **Material** (everything else — price, beds, size, unit, etc.): requires
  **Pause → edit → republish** through the full review gate, so the public surface
  can never silently diverge from what was reviewed.

## Server surface (owner-only)

`listing.publication.{checklist,submit,status,retry}`, `listing.manage` (LIVE/PAUSED
summary incl. saved count), `listing.pause`, `listing.resume`, `listing.classifyEdit`,
`listing.applyNonMaterialEdit`, `listing.preview`. UI:
`apps/web/src/components/sell/{publish-flow,publication-status,manage-listing}.tsx`
and the `sell/listings/[listingId]/{publish,publication,manage}` routes.
</content>
