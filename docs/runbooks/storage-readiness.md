# Runbook: Storage readiness

Migration `20260301000821_storage_production_constraints.sql` establishes the deployable bucket
contract. Customer paths are owner/listing scoped. API registration rejects cross-owner paths,
traversal, control characters, and unapproved metadata.

| Bucket                  | Visibility | Use                           | MIME types      | Maximum | Customer access                                   |
| ----------------------- | ---------- | ----------------------------- | --------------- | ------- | ------------------------------------------------- |
| `ownership-documents`   | Private    | Title deed/Oqood evidence     | PDF, JPEG, PNG  | 10 MiB  | Owner object-prefix read/write                    |
| `listing-photos-draft`  | Private    | Listing wizard photographs    | JPEG, PNG, WebP | 12 MiB  | Owner object-prefix read/write                    |
| `listing-photos`        | Public     | Approved LIVE listing photos  | JPEG, PNG, WebP | 12 MiB  | Anonymous read; writes only via trusted publisher |
| `transaction-documents` | Private    | Participant transaction files | PDF, JPEG, PNG  | 10 MiB  | Participant/owner upload and scoped read policy   |

## Flows

- Ownership and draft photo keys are `${customerId}/${listingId}/...`. Upload goes directly to the
  private bucket under Storage RLS, then the API registers only a matching owner/listing path.
- Publication fixes a stable public ID and copies verified draft photos to deterministic public
  keys with the server-only service role. Failed copy/database phases compensate.
- Private reads use short-lived signed URLs. Admin document access requires capability, purpose,
  acknowledgement, and a persisted requested → granted/failed audit lifecycle. Raw Storage paths are
  not returned in Admin DTOs.
- Replacements supersede metadata and invalidate dependent verification/readiness. Deletes are
  owner-scoped; public cleanup stays in the trusted publication pipeline.

The Admin's authenticated token has **no direct private-bucket read or signed-URL permission**.
The audited server capability is the only Admin document path. Public objects should receive an
immutable cache policy at the selected CDN only because their keys are deterministic; private
responses and signed URLs must not be publicly cached.

## Verification

Run `pnpm --filter @markaz/tests exec vitest run storage.test.ts` with current loopback keys. Week 8
verified: private buckets not public, public listing reads, anonymous private denial, object-scoped
URL expiry, Admin direct denial, service capability, bucket MIME allow-lists, and size limits.

## Production gaps

- Storage region/data residency, malware scanning, image decoding/re-encoding, object versioning,
  lifecycle cleanup, CDN headers, backup, and restore are not configured.
- MIME allow-lists are defense-in-depth, not content inspection.
- Listing ownership/draft-photo views use 30-minute customer-session URLs, transaction document
  reads use 60-second server-minted URLs, and audited Admin document access uses 300-second URLs.
  The expiry proof uses a one-second URL to verify timeout behavior; validate clocks and CDN
  behavior on the selected platform.
