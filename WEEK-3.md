# MARKAZ Home — Week 3 Delivery Report

**Milestone: Listing Publication + Customer-Facing Marketplace**

Seller publication (`READY_TO_PUBLISH` → simulated review → `LIVE`, with pause/resume
and material/non-material live edits) and a public, customer-facing marketplace —
real, persisted, secure, bilingual, anonymous-or-authenticated. Publication is an
**idempotent, compensated workflow**: public photos are prepared in Supabase Storage,
then a single **atomic database transition** flips the listing to `LIVE`. Supabase
Storage and PostgreSQL do **not** share one cross-system transaction; the database
`LIVE` transition alone is atomic, and Storage preparation is compensated on failure.
The marketplace reads exclusively through a **security-barrier view** that pre-projects
the §37 allowlist.

> Regulatory review is simulated. No real government, legal, payment, or transaction
> integration is performed.

Authoritative decision records: **ADR-0012** (public-photo pipeline) and **ADR-0013**
(anonymous marketplace access). UX governed by `docs/design/publication-design-spec.md`.
Architecture: `docs/architecture/publication-flow.md`, `marketplace.md`,
`public-listing-projection.md`, `listing-storage.md`.

---

## 1. Milestone scope

In scope and delivered: seller publication and the customer marketplace, including all
persisted writes (publish, pause, resume, save, non-material live edits). Explicitly
**out of scope** (next milestones): offers, counter-offers, transactions, the full
Admin Portal, payments, messaging, map/geo search, durable job queues, AWS
provisioning, and any real DLD/Trakheesi/Madmoun/payment integration. This closure
also hardened the Week 3 security boundary (server-only public-photo writes,
database-level self-save prevention) and corrected the publication consistency model
and its documentation.

## 2. What was built

- **Seller publication** (spec §4–§5, §12–§18): server-authoritative checklist +
  eligibility (`packages/domain/src/publication.ts`); submit → simulated review →
  atomic `LIVE` via `PublicationReviewService`; pause/resume; material vs
  non-material live edits (§17.4, default-to-material).
- **Customer marketplace** (spec §19–§30): anonymous + authenticated browse / search /
  filter / sort with 24-per-page pagination; public detail page keyed by the opaque
  `public_id`; save property; saved properties; anonymous save interception (§28).
- **Security/consistency closure (this milestone):**
  - Public `listing-photos` bucket is **read-only for customers**; writes only via the
    server-side publication service (service role).
  - `property_photos.public_path` is **server-only** (trigger-guarded).
  - **Self-save / non-LIVE-save / cross-user** saves are blocked by **RLS**, not just
    the API.
  - Publication rewritten as an **idempotent, compensated workflow** with
    fault-injection test seams.
- **Database**: forward-only migrations `…0800 / 0801 / 0802 / 0803`.
- **API**: `marketplace` router (`publicTxProcedure`), publication procedures, the
  `public-projection.ts` allow-list mappers, and the service-role-isolated photo
  pipeline (`packages/db/src/storage-admin.ts`).
- **Web UI** (`apps/web`): `(public)` route group + adaptive header; browse grid;
  card / detail / gallery; save button + intent redirect; saved properties; seller
  `publish` / `publication` / `manage` screens.
- **i18n**: marketplace / filters / sort / property / save / saved / publication /
  pause / resume / investmentCase (en + **ar draft, flagged unreviewed**).
- **Seed**: Week-3 marketplace + publication scenarios (§11 below).

## 3. What was preserved

Turborepo/pnpm workspace, `apps/web` + separate `apps/admin`, canonical migrations +
Drizzle mirror, tRPC tiers + RLS-context strategy, Customer/Admin separation,
email/password auth, the `DRAFT → READY_TO_PUBLISH` listing wizard, draft-photo and
ownership-document privacy (ADR-0011), en/ar + RTL, `@markaz/ui`, Supabase local,
realtime + storage foundations, demo provisioning. No authentication, listing
state-machine, public-projection, or wizard rework.

## 4. Final routes

```
/[locale]/properties                                 marketplace (anon or authed)
/[locale]/properties/[publicId]/[slug]               public detail page
/[locale]/saved-properties                           saved (customer-only)
/[locale]/sell/listings/[id]/publish                 publication checklist + confirm
/[locale]/sell/listings/[id]/publication             review status → LIVE success
/[locale]/sell/listings/[id]/manage                  LIVE/PAUSED management
```

The `(public)` group has **no auth guard** (anonymous browse); `MarketplaceHeader`
adapts to a session when present. `saved-properties` and the seller screens require an
onboarded `CUSTOMER` and verify ownership **server-side**; non-owners get the same safe
"not available" copy (anti-enumeration). The customer app exposes **no** admin route.

## 5. Publication-request model

The listing enum is **unchanged** (`READY_TO_PUBLISH`, `LIVE`, `PAUSED`). Review status
lives in a **separate** `listing_publication_requests` table
(`NOT_SUBMITTED / PENDING / APPROVED_DEMO / REJECTED_DEMO`) with a partial unique index
allowing **one active (non-superseded) request per listing**. Submit supersedes any
prior request, fixes a stable `public_id` on the listing, and creates a fresh `PENDING`
request (idempotent). `outcome_category` stores a **safe category only**
(`CHECKLIST_INCOMPLETE` / `PHOTO_PROCESSING_FAILED` / `DEMO_REVIEW_RETURNED` /
`PROCESSING_ERROR`) — never raw notes. A returned review never moves the listing to a
`REJECTED` state; the listing stays recoverable.

## 6. Accurate publication workflow (idempotent + compensated)

Publication is **not** a single cross-system atomic transaction. The sequence
(`PublicationReviewService.resolve`):

1. Load the active request; if it is not `PENDING`, return (idempotent — a repeat is a
   no-op).
2. Re-validate the §4.4 eligibility gate at resolve time (state `READY_TO_PUBLISH`,
   ≥1 photo, a cover, asking price > 0, a non-superseded `VERIFIED_DEMO` permit).
3. **Phase 1 — prepare public photos** (service role): copy each draft object to the
   public bucket at the deterministic key `${publicId}/${photoId}`, set `public_path`
   (elevated `postgres` connection), then **verify** every object exists.
4. If any photo step fails → **compensate**: remove the public objects prepared this
   attempt and clear staged `public_path`; keep the listing non-LIVE; return a
   **retryable** `PHOTO_PROCESSING_FAILED`.
5. **Phase 2 — atomic database `LIVE` transition** (one PostgreSQL transaction): flip
   to `LIVE`, set `public_id` / `public_slug` / `published_at` / `public_updated_at` /
   `publication_version`, and approve the request. Commit.
6. If Phase 2 fails after photos were prepared → **compensate** (Storage cleanup) and
   leave the request `PENDING` (retryable). The listing is never `LIVE` with partial or
   missing public photos.

The overall flow is **idempotent, compensated, retryable, and all-or-nothing from the
user's perspective**. A retry re-copies to the **same** keys (no duplicate objects); a
re-resolve after success is a no-op.

## 7. Atomic database transition boundary

Only step 5 is a database transaction. **The database transition to `LIVE` is atomic.**
The opaque `public_id` is fixed at submit (so photo keys are deterministic and
retry-safe) but stays non-public until `LIVE` because the marketplace view requires
`state = 'LIVE' AND public_id IS NOT NULL`. No reader ever sees a listing as `LIVE`
before the transaction commits.

## 8. Compensating Storage cleanup

`removePublicPhotos` removes only the supplied, listing-scoped keys and is safe to call
repeatedly (idempotent; never a broad prefix delete). `clearPublicPhotoPaths` nulls
`public_path` for the listing and is idempotent. Both run via the elevated server
connection (service role / `postgres`). Compensation runs on both failure paths
(Phase 1 photo failure, Phase 2 database failure) and is independent of the failed
database transaction.

## 9. Public-photo write policy (server-only)

Migration 08.3 makes the public `listing-photos` bucket **read-only for customers**:
the three customer write policies were dropped. The publication service writes via the
**service-role** key (which bypasses RLS) and is the **only** writer. An ordinary
`authenticated` customer cannot insert, overwrite, or delete objects in the public
bucket. The service-role key is never shipped to the browser and is used only in the
narrow photo pipeline.

## 10. Public-photo read policy

`listing_photos_public_read` grants `SELECT` to `anon` + `authenticated` on the public
bucket — published photos are world-readable by public URL (no signing) by design.
Draft photos (`listing-photos-draft`) and ownership documents stay in their **private**
buckets and never enter the public bucket (ADR-0011/0012).

## 11. `public_path` protection

A `BEFORE INSERT/UPDATE` trigger `guard_public_photo_path` on `property_photos` blocks
the `authenticated`/`anon` roles from setting or changing `public_path` (privileged
roles `service_role`/`postgres` are exempt). A customer keeps full control of **draft**
photo metadata (register, reorder, cover, delete) but can never decide or supply a
public object path/bucket/URL. The value is server-derived (`${publicId}/${photoId}`)
and written only by the pipeline. No tRPC mutation accepts `public_path`.

## 12. Public projection and privacy

The `marketplace_listings` **security-barrier view** is the **only** public data source
— anon and authenticated roles read it, never the raw `properties` /
`property_photos` / `investment_cases` tables (which carry private columns). The §37
allowlist is enforced **twice**: by the view (column projection) and by the explicit
`toPublicCard` / `toPublicDetail` mappers (allow-list mapping, never
delete-fields-from-a-row). NEVER public: ownership docs, private storage paths, signed
URLs, draft photos, seller identity/contact, unit identifier, occupancy, verification /
Form A / permit internals, audit, internal UUIDs, private Investment Case inputs.
`getByPublicId` returns `null` for a missing/non-LIVE id → a **unified unavailable
state** (anti-enumeration). Owner-only fields (`isOwner` / `manageListingId`) are added
**outside** the projection.

## 13. Saved-property RLS

`saved_properties` uses per-command policies: `SELECT`/`DELETE` are own-rows-only
(`customer_id = auth.uid()`); `INSERT`/`UPDATE` add a `WITH CHECK` requiring
`EXISTS(listing l WHERE l.state = 'LIVE' AND l.owner_id <> auth.uid())`. A customer may
save another customer's LIVE listing and remove their own saves; they cannot read other
customers' saves, insert rows for another user, save a non-LIVE listing, or swap the
listing reference to bypass the check.

## 14. Self-save database enforcement

Owner-cannot-save-own is enforced at the **database boundary** by the `INSERT`/`UPDATE`
`WITH CHECK` above (the `owner_id <> auth.uid()` clause), mirroring the existing
`offers_insert_own` rule — **not** an API-only or future concern. The tRPC layer keeps
a friendly pre-check, but the database is authoritative.

## 15. Pause and resume

A `LIVE` listing pauses out of the marketplace (`PAUSED`, hidden from the view and the
public route) and resumes back to `LIVE` after **re-validating the §4.4 gate**
(material edits made while paused require publication review again). Saved relationships
survive a pause; a paused listing shows as a safe unavailable stub to savers.

## 16. Marketplace search, filters, sort, and pagination

Shared `marketplaceQuerySchema` (domain) validates the URL state and the server query
identically. Filters: type, price range, bedrooms, community, bathrooms, size,
furnishing, completion, Investment-Case-available. Sorts: Newest (default), Price ↑,
Price ↓, Size ↓ (stable tiebreak on `public_id`). Pagination is **24 per page**; the
page resets to 1 on any search/filter/sort change. All queries run over the
security-barrier view via `publicTxProcedure` (anon or authenticated).

## 17. Tests with exact totals

Static gate (this closure):

- `pnpm typecheck` — **12/12 packages clean**.
- `pnpm lint` — **11/11 packages clean**.
- `pnpm build` — **web + admin** build succeed; all new routes register.
- `pnpm --filter @markaz/domain test` — **71/71** (4 files: domain, routing,
  listing-journey, publication, marketplace).
- `pnpm --filter @markaz/web test` — **31/31** (6 component files).

Integration (live local Supabase stack), **8 files / 49 tests passing**:

| Suite                                  | Tests  | Covers                                                                                                                                                                                                                                      |
| -------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rls.test.ts`                          | 9      | RLS identity propagation + policy matrix                                                                                                                                                                                                    |
| `storage.test.ts`                      | 3      | public read / private signed-URL boundary                                                                                                                                                                                                   |
| `listing-privacy.test.ts`              | 5      | draft public-projection privacy                                                                                                                                                                                                             |
| `provisioning.test.ts`                 | 3      | demo provisioning                                                                                                                                                                                                                           |
| `listing-journey.test.ts`              | 6      | wizard → READY                                                                                                                                                                                                                              |
| `publication-marketplace.test.ts`      | 4      | publish→LIVE→anon marketplace, privacy, pause/resume, owner-cannot-save                                                                                                                                                                     |
| **`publication-security.test.ts`**     | **14** | Storage write/update/delete denied for customers; reads allowed; service copy/cleanup; `public_path` customer-write denied + elevated-write allowed; saved-property self/non-LIVE/cross-user denied + cross-owner-LIVE allowed + own-remove |
| **`publication-compensation.test.ts`** | **5**  | Scenarios A–E: partial photo failure cleanup; DB-failure-after-copy cleanup + retry→LIVE; retry produces no duplicate objects; repeated success no-op; repeated cleanup safe                                                                |

## 18. Full E2E results

Playwright (`@axe-core/playwright`), run against the built web app:

- `e2e/marketplace.spec.ts` — **4/4** (anonymous browse + filter + open; anonymous Save
  interception dialog; browse-page axe; authenticated saved available/unavailable).
- `e2e/marketplace-detail.spec.ts` — **8/8** (visible Investment Case + disclosure;
  hidden IC absent; gallery keyboard arrows + Escape; owner treatment — Your listing +
  Manage, no Save; detail axe; saved axe; Arabic RTL; mobile viewport).
- `e2e/seller-publication.spec.ts` — publish → review → `LIVE` → public page;
  returned-for-changes + retry → `LIVE`; public-photo processing-failure state +
  actionable retry; publication-checklist axe; pause → gone from marketplace → resume
  (serial); live-management axe. _(Last observed run before the local Docker daemon
  wedged: 5 passing; the resume step then failed because the seeded Marina LIVE listing
  lacked the readiness records `resume` re-validates — fixed in `setup-demo.ts`; a
  clean-stack re-run is the closing confirmation, see §22.)_

Existing Week 1 / 1.5 / 2 e2e (`auth-password`, `foundation`, `listing-journey`,
`listing-quality`) are unchanged.

## 19. Accessibility (axe) results

Axe (`wcag2a` + `wcag2aa`, failing on critical/serious) passed with **no
critical/serious violations** on all five required routes:

1. Marketplace browse (`marketplace.spec.ts`).
2. Property detail (`marketplace-detail.spec.ts`).
3. Saved properties (`marketplace-detail.spec.ts`).
4. Publication checklist (`seller-publication.spec.ts`).
5. Live-listing management (`seller-publication.spec.ts`).

Also implemented: one `h1` + skip link per route, search/filter labels, polite
results-count + save-state live regions, dialog focus trap/restore, keyboard-navigable
gallery with focus restoration, 44px touch targets, and `prefers-reduced-motion`
handling on image transitions.

## 20. Arabic and RTL evidence

`/ar/properties` and `/ar/properties/[publicId]/[slug]` render with `dir="rtl"`
(asserted in `marketplace-detail.spec.ts`). Layout uses logical CSS properties; building/
community names and numbers stay LTR within RTL text (`dir="auto"` on user content). All
Week-3 Arabic copy is a **flagged unreviewed draft** with full key parity to English.

## 21. Mobile evidence

`marketplace-detail.spec.ts` exercises a 390×844 viewport: the browse grid collapses to
a single column, cards remain tappable, the property page and its sticky Save action
render, and the detail opens from a card tap.

## 22. Remaining limitations

- **Arabic copy is a flagged draft** — not legally/professionally reviewed.
- **Simulation timing** is resolve-on-poll (no durable job queue — out of scope): a
  `PENDING` request resolves when its status is next read.
- The public bucket serves objects by **public URL** (no signing) — correct for
  _published_ photos only; drafts/documents never enter it.
- **Closing validation note:** during this closure the local Docker daemon wedged on
  the Supabase API gateway (Kong became uncancellable after repeated stack resets),
  which blocks `db:setup` and browser sign-in until Docker Desktop is restarted. All
  static checks, the full integration suite (49 tests), and the marketplace +
  marketplace-detail e2e (12 tests) were verified green this session on a healthy
  stack; the seller-publication e2e was last green at 5 tests with the resume fix
  applied afterward. The single closing step is one clean-stack run:
  `pnpm supabase:reset && pnpm db:setup && pnpm lint && pnpm typecheck && pnpm test &&
pnpm test:e2e && pnpm build`.

## 23. Acceptance checklist

- [x] Public-photo customer **insert / update / delete denied**; published-photo public
      reads still work; the publication service can copy and clean up.
- [x] `property_photos.public_path` **cannot be controlled by customers** (trigger).
- [x] **Self-save**, **non-LIVE save**, and **cross-user** saves blocked by **RLS**;
      cross-owner LIVE save + own-remove allowed.
- [x] Publication documented + implemented as **idempotent + compensated**; the
      **database `LIVE` transition is atomic**.
- [x] Partial photo failure cleans up; database failure after Storage prep cleans up;
      repeated cleanup is safe; retry creates no duplicate objects; never `LIVE` with
      partial/missing photos.
- [x] Anonymous + authenticated browse / search / filter / sort; 24-per-page;
      anti-enumeration unavailable state; save interception; pause/resume.
- [x] Marketplace reads **only** the security-barrier view; §37 allowlist enforced by
      the view **and** the mappers.
- [x] Integration tests run against the active local stack; static gate + builds green.
- [x] Axe passes on all five required routes; Arabic RTL + mobile covered.
- [ ] **Single closing confirmation pending** — one clean-stack full `test:e2e` run
      after a Docker Desktop restart (§22); all constituent suites already verified.

## 24. Week 4 readiness

The marketplace and publication pipeline are complete and secured at the database
boundary. The public projection, the LIVE-only security-barrier view, and the opaque
`public_id` give offers/transactions a stable, private-safe surface. No publication or
marketplace restructuring is required to begin Week 4 (Buyer Offers / Seller Offer
Management).
