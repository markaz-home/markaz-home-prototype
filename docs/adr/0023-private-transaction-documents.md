# ADR-0023 — Private transaction documents (Week 5)

## Status

Accepted (Week 5). Storage foundation built; upload API/UI pending (see WEEK-5.md).

## Context

Prototype transaction documents must stay private and participant-scoped, using fictional files
only, with no public URLs and no content parsing.

## Decision

A private `transaction-documents` Storage bucket with owner/participant-scoped RLS (mirrors the
Week-2 draft-photo private bucket, ADR-0011). `transaction_documents` rows carry
`(uploaded_by, document_type, storage_path, mime_type, size_bytes, status)` with CHECK
constraints (MIME ∈ pdf/jpg/png, ≤ 10 MB) and a unique active file per
`(transaction, uploader, type)`. RLS: a participant reads only their **own** uploaded files;
the other party sees only per-type **completeness** (projected server-side) — never filenames,
previews, or signed URLs. Signed URLs are short-lived and uploader/admin only; no storage path
appears in UI, logs, or audit. Content is never parsed/OCR'd/indexed.

## Consequences

Two-party privacy with a single shared transaction. The bucket + RLS + schema are in migration
`…0808`; the register/remove/signed-URL API procedures and upload control are the remaining
Phase-C work. See ADR-0011, ADR-0012.
