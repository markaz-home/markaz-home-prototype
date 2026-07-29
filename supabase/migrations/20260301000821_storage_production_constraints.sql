-- Week 8 production-readiness hardening.
--
-- 1. Enforce the same MIME/size limits at the Storage bucket boundary that the
--    application and relational constraints already enforce.
-- 2. Remove direct authenticated-ADMIN reads from private buckets. Admin document
--    access must go through the audited service-role signed-URL flow (ADR-0027);
--    knowing a raw object path must not bypass REQUESTED -> GRANTED/FAILED audit.

update storage.buckets
set
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png']::text[]
where id = 'ownership-documents';

update storage.buckets
set
  public = false,
  file_size_limit = 12582912,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']::text[]
where id = 'listing-photos-draft';

update storage.buckets
set
  public = true,
  file_size_limit = 12582912,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']::text[]
where id = 'listing-photos';

update storage.buckets
set
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png']::text[]
where id = 'transaction-documents';

drop policy if exists ownership_docs_owner_rw on storage.objects;
create policy ownership_docs_owner_rw on storage.objects
  for all to authenticated
  using (bucket_id = 'ownership-documents' and owner = auth.uid())
  with check (bucket_id = 'ownership-documents' and owner = auth.uid());

drop policy if exists listing_photos_draft_owner_rw on storage.objects;
create policy listing_photos_draft_owner_rw on storage.objects
  for all to authenticated
  using (bucket_id = 'listing-photos-draft' and owner = auth.uid())
  with check (bucket_id = 'listing-photos-draft' and owner = auth.uid());

drop policy if exists transaction_documents_owner_rw on storage.objects;
create policy transaction_documents_owner_rw on storage.objects
  for all to authenticated
  using (bucket_id = 'transaction-documents' and owner = auth.uid())
  with check (bucket_id = 'transaction-documents' and owner = auth.uid());
