# ADR-0027 — Audited private-document access (Week 6)

## Status

Accepted (Week 6).

## Context

Operators occasionally need to view a private customer document (e.g. a verification
review), but private documents must stay private, unindexed, and access must be recorded.

## Decision

Two capabilities: `VIEW_PRIVATE_DOCUMENT_METADATA` (safe metadata only — never the storage
path) and `ACCESS_PRIVATE_DOCUMENT`. Opening requires an explicit purpose (reason enum) and
an acknowledgement. The access audit is an **exact lifecycle** (migration `…0815`), not a single
event: `ADMIN_DOCUMENT_ACCESS_REQUESTED` is written **before** minting a **300-second** signed URL
through the allow-listed bucket helper (`adminPrivateSignedUrl`, buckets:
ownership/transaction/listing-draft), then `ADMIN_DOCUMENT_ACCESS_GRANTED` on success or
`ADMIN_DOCUMENT_ACCESS_FAILED` on mint failure. Crucially the procedure **returns** (does not throw)
on failure, so the FAILED audit commits — a thrown error would roll back the request transaction and
lose every audit row written in it. The path/URL is never returned in metadata, logged, or shown.
Content is never parsed or indexed.

## Consequences

Access is possible, minimal, short-lived, and truthfully audited: an event never claims success it
did not achieve (REQUESTED always precedes the outcome; GRANTED/FAILED reflect reality). Mirrors the
Week-5 participant-scoped document model (ADR-0023).
