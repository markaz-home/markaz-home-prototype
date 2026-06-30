# ADR 0012: Public-photo pipeline (draft → public bucket on publish)

- **Status:** Accepted
- **Date:** 2026-06 (Week 3)

## Context

Week 2 stored draft listing photographs in the **private** `listing-photos-draft`
bucket, uploaded and read with the **customer's own session** under storage RLS,
never with the service-role key (ADR-0011). ADR-0011 reserved the **public**
`listing-photos` bucket for the future publication milestone.

Week 3 publishes a listing to `LIVE` and must serve its photographs to **anonymous**
marketplace visitors. A private bucket only serves objects through short-lived
signed URLs minted by an authenticated owner session — that cannot serve an
anonymous public grid. The published photos therefore have to reach the **public**
bucket, while ownership documents (a "never public" asset class) and *unpublished*
draft photos must stay private. The preparation of public photos and the database
LIVE transition must be coordinated: a listing must never go `LIVE` with a partial
or broken photo set. Supabase Storage and PostgreSQL do not share a cross-system
transaction, so the pipeline uses an idempotent, compensated workflow — if Storage
preparation succeeds but the database transition fails, the prepared objects are
cleaned up and the request remains retryable.

## Decision

On publish, copy each draft object into the public bucket through a **narrow,
service-role-isolated** pipeline (`packages/db/src/storage-admin.ts`):

1. **`copyDraftPhotoToPublic(draftPath, publicPath, contentType)`** — downloads the
   object from `listing-photos-draft` and uploads it to `listing-photos` at the
   **deterministic** key `publicPhotoKey(publicId, photoId)` = `${publicId}/${photoId}`
   (upsert → idempotent). The key is stable across retries, so a retry never creates
   duplicate public objects. `verifyPublicPhotos` confirms every expected object is
   present after copying. `removePublicPhotos` removes only the supplied keys (never a
   broad prefix) and is safe to call repeatedly.

2. **Compensated, idempotent workflow** (`PublicationReviewService.resolve`,
   `packages/api/src/services/publication.ts`): **Supabase Storage and PostgreSQL do
   NOT share a cross-system transaction.** Public-photo preparation and the database
   LIVE transition form an idempotent, compensated publication workflow:
   - **Phase 1 — public photo preparation (service role; compensable):** photos are
     copied in a loop; `public_path` is recorded for each via `setPublicPhotoPath`
     (elevated `postgres` connection, outside the caller's RLS transaction). On any
     failure: compensate (`removePublicPhotos` + `clearPublicPhotoPaths`), keep the
     listing non-`LIVE`, return `REJECTED_DEMO` / `PHOTO_PROCESSING_FAILED` (retryable).
   - **Phase 2 — atomic database LIVE transition (one PostgreSQL transaction):** flip
     to `LIVE` + publication metadata + approve the request. If this phase fails after
     photos were prepared: compensate (Storage cleanup), keep the listing non-`LIVE`,
     leave the request `PENDING` (retryable). A retry re-copies to the same
     deterministic keys — no duplicate objects are created.
   - A re-resolve after a successful LIVE transition is a no-op (the request is no
     longer `PENDING`).

3. **Why the elevated context here, and only here.** The copy must read a **private**
   object and write to the **public** bucket. The public bucket is **customer
   read-only** (migration 08.3 dropped the three customer write policies —
   `listing_photos_owner_write/modify/delete`; only `listing_photos_public_read` for
   `anon + authenticated SELECT` remains). Using the service-role key for this narrow
   server operation is both required (customers cannot write to the public bucket) and
   safer than widening customer-facing RLS. This is the **one** place the service-role
   key touches a customer-scoped flow — tightly scoped to the two photo buckets, never
   `ownership-documents`, and invoked only from the publish resolver after the §4.4
   gate passes.

4. **`property_photos.public_path` is server-only.** The trigger
   `guard_public_photo_path` (migration 08.3) raises `check_violation` when the
   `authenticated` or `anon` role attempts to set `public_path` on `INSERT` (non-null)
   or to change it on `UPDATE`. Privileged roles (`service_role`, `postgres`) are
   exempt. `setPublicPhotoPath` and `clearPublicPhotoPaths` run via the app's elevated
   `postgres` connection (`getAppDb()`), **outside** the caller's RLS transaction. The
   value is always server-derived (`publicPhotoKey(publicId, photoId)`) and never
   customer-supplied. Customers retain full control of their draft photo metadata
   (register, reorder, cover, delete) but can never set or supply a public object path.

Public objects are keyed by `${publicId}/${photoId}` — opaque, derived from the
listing's opaque `public_id` (never the unit identifier or owner id), so a public
URL leaks nothing. After migration 08.3, the public bucket's only RLS policy is
`listing_photos_public_read` (`SELECT` to `anon, authenticated`). No customer write
policies exist; the service role bypasses RLS and is the sole writer.

## Alternatives considered

- **Serve drafts via signed URLs to anonymous visitors.** Rejected: signed URLs
  require an authenticated minting session and expire; they cannot back an anonymous,
  cacheable public grid, and they would expose the private draft path/bucket.
- **Make the customer session do the copy.** Rejected: since migration 08.3 no
  customer write policies exist on the public bucket by design; even before that
  removal, widening customer-facing RLS to span both buckets would have been the
  wrong trade-off. The single, audited server operation is both required and cleaner.
- **Reference draft objects directly from public responses.** Rejected: it leaks the
  private bucket/path and breaks the privacy boundary (ADR-0013).

## Consequences

- `property_photos.public_path` points into the **public** `listing-photos` bucket;
  the public URL is unsigned (`publicPhotoUrl` in `public-projection.ts`). Writing
  and clearing `public_path` is reserved for the publication service (via the elevated
  `postgres` connection); the `guard_public_photo_path` trigger (migration 08.3)
  blocks all `authenticated`/`anon` writes to this column.
- The database transition to LIVE is atomic. Public-photo preparation and the database
  LIVE transition form an idempotent, compensated publication workflow; there is no
  cross-system atomic transaction spanning Storage and PostgreSQL.
- A LIVE listing always has a complete public photo set, or it is not LIVE.
- On photo-preparation failure the request resolves as `REJECTED_DEMO` /
  `PHOTO_PROCESSING_FAILED` (the listing stays non-`LIVE`; the customer may retry).
  On database-transition failure the request stays `PENDING` (retryable); a retry
  re-copies to the same deterministic keys without creating duplicate objects.
- The public bucket (`listing-photos`) is customer read-only; all writes are
  exclusively via the service role during the publication pipeline.
- The service-role key remains absent from every customer **read** path; its only
  customer-scoped use is this narrow copy, covered by the publication→marketplace
  integration test (which uploads a real PNG and asserts the public cover URL).
- Re-publication overwrites public objects (upsert) at the same deterministic keys;
  the opaque `public_id` is stable across re-publication.
</content>
