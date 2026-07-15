# ADR 0011: Draft listing-photo privacy (private bucket + signed URLs)

- **Status:** Accepted
- **Date:** 2026-06 (Week 2)

## Context

Week 1 created two storage buckets (migration 04): `ownership-documents`
(**private**) and `listing-photos` (**public**). A public Supabase bucket serves
objects by public URL regardless of RLS, so any object placed in `listing-photos`
is publicly fetchable by anyone who knows the path.

The Week 2 listing journey uploads **draft** property photographs **before**
publication. Product rules (design spec §3.11, §31.7) require that draft photos
are **not** publicly reachable until a future publication milestone, while
ownership documents are **never** public. Putting draft photos in the existing
public bucket would leak them.

## Decision

Introduce a **new private bucket `listing-photos-draft`** (migration 07) for
draft photographs, with owner-scoped storage RLS (`owner = auth.uid()` or admin),
mirroring the `ownership-documents` policy. Draft photos are uploaded with the
**customer's own session** (RLS enforces ownership — the service-role key is never
used) and read via **short-lived signed URLs** (`getSignedUrl(s)` in
`apps/web/src/lib/listing-storage.ts`). Public URLs / object paths are never
exposed.

The existing **public `listing-photos` bucket is retained, unused for now**, and
reserved for the future publication milestone: on publish, a LIVE listing's
photos will be copied/promoted from the private draft bucket to the public bucket
(or served via a public projection). This keeps the future public-delivery path
straightforward and **preserves the Week-1 storage-boundary proof** (which still
demonstrates the public `listing-photos` vs private `ownership-documents`
boundary) without modification.

## Alternatives considered

- **Make `listing-photos` private now.** Rejected: it would change the Week-1
  storage proof and its passing integration test, and complicate the eventual
  public-delivery path (needs a path→listing→LIVE RLS subquery).
- **Reuse `ownership-documents` for photos.** Rejected: mixes a "never public"
  bucket with a "public later" asset class, muddying the privacy model.

## Consequences

- `property_photos.storage_path` points into `listing-photos-draft`.
- Owner-only access during draft is enforced by storage RLS + signed-URL delivery
  and covered by an access-boundary integration test.
- Publication (future milestone) adds a copy-to-public step; no schema rewrite.
