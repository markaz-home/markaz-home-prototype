# Listing Storage & Document/Photo Privacy

See **ADR-0011** for the draft-photo privacy decision.

## Buckets

| Bucket | Public? | Contents | Access |
| --- | --- | --- | --- |
| `ownership-documents` | **private** | fictional ownership documents | owner or admin; signed URLs only |
| `listing-photos-draft` | **private** | draft listing photographs | owner (read + write own objects) or admin; signed URLs only |
| `listing-photos` | public | published listing photographs (Week 3) | public read (`anon + authenticated SELECT`); **server-only writes** via service role during publication |

Storage RLS (`supabase/migrations/…0400` + `…0700` + `…0803`) scopes the private
buckets to `owner = auth.uid()` (or `is_admin()`). Draft photos are **never**
publicly reachable before publication; ownership documents are **never** public.

The **public** bucket is **customer read-only** (migration 08.3 dropped the three
customer write policies — `listing_photos_owner_write/modify/delete`; only
`listing_photos_public_read` remains). All writes to the public bucket are performed
exclusively by the publication pipeline using the service-role key, which bypasses
RLS. Draft bucket customer write access is unchanged.

## Upload & delivery

- Uploads run client-side with the **customer's own Supabase session**
  (`apps/web/src/lib/listing-storage.ts`) — RLS enforces ownership. The
  service-role key is never used for these customer-scoped operations.
- Only **metadata** (path, original name, content type, size, type, status,
  cover/order) is stored relationally — never the file body.
- Reads use **short-lived signed URLs** (`getSignedUrl`/`getSignedUrls`); object
  paths and public URLs are not exposed in DTOs, audit events, or the preview.

## Relational tables

- `ownership_documents` — one **active** document per listing (partial unique
  index); replacing supersedes the prior and resets verification.
- `property_photos` — exactly **one cover** per listing (partial unique index),
  `sort_order` for ordering, metadata columns.

## Publication photo pipeline

On publication (Week 3), draft photos are copied from `listing-photos-draft` to the
public `listing-photos` bucket by the service-role-isolated pipeline in
`packages/db/src/storage-admin.ts`. The object key is deterministic:
`publicPhotoKey(publicId, photoId)` = `${publicId}/${photoId}` — stable across
retries so a retry never creates duplicate objects. The copy is upsert (idempotent).
`verifyPublicPhotos` confirms each object exists; `removePublicPhotos` removes only
the supplied keys (key-scoped, never a broad prefix) and is safe to call repeatedly.

`property_photos.public_path` records the public object key and is **server-only**:
the `guard_public_photo_path` trigger (migration 08.3) raises `check_violation` when
the `authenticated` or `anon` role attempts to set or change this column. It is
written exclusively by `setPublicPhotoPath` and cleared by `clearPublicPhotoPaths`,
both of which run via the elevated `postgres` connection (`getAppDb()`) outside the
caller's RLS transaction. See `docs/architecture/publication-flow.md` and ADR-0012
for the full compensated-workflow sequence.

`toPublicProjection` (`packages/api/src/routers/listing.ts`, tested) emits only
public fields — never the ownership document, the private unit identifier,
occupancy status, or a hidden Investment Case. The marketplace projection uses
`toPublicCard` / `toPublicDetail` in `packages/api/src/public-projection.ts`.

## Deletion

Deleting a draft removes its DB rows (cascade) and returns the storage paths; the
web caller removes the objects from both private buckets with the owner session.
