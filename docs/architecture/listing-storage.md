# Listing Storage & Document/Photo Privacy

See **ADR-0011** for the draft-photo privacy decision.

## Buckets

| Bucket | Public? | Contents | Access |
| --- | --- | --- | --- |
| `ownership-documents` | **private** | fictional ownership documents | owner or admin; signed URLs only |
| `listing-photos-draft` | **private** | draft listing photographs (Week 2) | owner or admin; signed URLs only |
| `listing-photos` | public | reserved for **published** photos (future) | public read (unused this milestone) |

Storage RLS (`supabase/migrations/…0400` + `…0700`) scopes the private buckets to
`owner = auth.uid()` (or `is_admin()`). Draft photos are **never** publicly
reachable before publication; ownership documents are **never** public.

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

## Public projection & future publication

`toPublicProjection` (`packages/api/src/routers/listing.ts`, tested) emits only
future-public fields — never the ownership document, the private unit identifier,
occupancy status, or a hidden Investment Case. On publication (future milestone),
LIVE photos will be copied/promoted from `listing-photos-draft` to the public
`listing-photos` bucket; the projection mapper already exists, so no rewrite is
needed.

## Deletion

Deleting a draft removes its DB rows (cascade) and returns the storage paths; the
web caller removes the objects from both private buckets with the owner session.
