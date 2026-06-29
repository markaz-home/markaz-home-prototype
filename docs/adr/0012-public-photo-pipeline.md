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
draft photos must stay private. The copy also has to be **atomic** with the LIVE
transition: a listing must never go public with a partial or broken photo set.

## Decision

On publish, copy each draft object into the public bucket through a **narrow,
service-role-isolated** pipeline (`packages/db/src/storage-admin.ts`):

1. **`copyDraftPhotoToPublic(draftPath, publicPath, contentType)`** — downloads the
   object from `listing-photos-draft` and uploads it to `listing-photos` at the
   **opaque** key `${publicId}/${photoId}` (upsert → idempotent). `removePublicPhotos`
   removes public objects on failure / re-publication (best-effort).
2. **All-or-nothing** (`PublicationReviewService.resolve`,
   `packages/api/src/services/publication.ts`): photos are copied in a loop,
   recording each prepared `public_path`. On **any** failure the service removes the
   prepared public objects, **nulls every `public_path`** for the listing, and
   returns the request as `REJECTED_DEMO` with category **`PHOTO_PROCESSING_FAILED`**.
   The atomic LIVE transition runs **only after** every photo is prepared — the
   listing never reaches `LIVE` with a partial photo set.
3. **Why the elevated context here, and only here.** The copy must read a **private**
   object and write a **public** one. The customer's RLS session can read its own
   draft but the public-read/owner-write policy on `listing-photos` is deliberately
   minimal; doing the cross-bucket copy under a single, audited server operation is
   simpler and safer than widening customer-facing RLS to span both buckets. This is
   the **one** place the service-role key touches a customer-scoped flow. It is
   tightly scoped: only the two photo buckets, never `ownership-documents`, and it is
   invoked only from the publish resolver after the §4.4 gate passes.

Public objects are keyed by `${publicId}/${photoId}` — opaque, derived from the
listing's opaque `public_id` (never the unit identifier or owner id), so a public
URL leaks nothing. The public bucket's read policy (migration 08) is
`select to anon, authenticated`; only the owner/admin may write or clean up.

## Alternatives considered

- **Serve drafts via signed URLs to anonymous visitors.** Rejected: signed URLs
  require an authenticated minting session and expire; they cannot back an anonymous,
  cacheable public grid, and they would expose the private draft path/bucket.
- **Make the customer session do the copy.** Rejected: it would require RLS that lets
  a customer write the public bucket *and* read across buckets, widening the surface;
  the all-or-nothing cleanup is also cleaner as one server operation.
- **Reference draft objects directly from public responses.** Rejected: it leaks the
  private bucket/path and breaks the privacy boundary (ADR-0013).

## Consequences

- `property_photos.public_path` points into the **public** `listing-photos` bucket;
  the public URL is unsigned (`publicPhotoUrl` in `public-projection.ts`).
- A LIVE listing always has a complete public photo set, or it is not LIVE.
- The service-role key remains absent from every customer **read** path; its only
  customer-scoped use is this narrow copy, covered by the publication→marketplace
  integration test (which uploads a real PNG and asserts the public cover URL).
- Re-publication overwrites public objects (upsert) and may clean up stale ones; the
  opaque `public_id` is stable across re-publication.
</content>
