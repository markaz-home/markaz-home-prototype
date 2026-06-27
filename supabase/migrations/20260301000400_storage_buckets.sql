-- =============================================================================
-- MARKAZ Home — canonical migration 04: storage buckets + policies
-- Private ownership documents (signed URLs only) and public listing photos.
-- Proven by the storage boundary tests (Step 16).
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('ownership-documents', 'ownership-documents', false)
on conflict (id) do update set public = excluded.public;

insert into storage.buckets (id, name, public)
values ('listing-photos', 'listing-photos', true)
on conflict (id) do update set public = excluded.public;

-- --- Private bucket: owner (uploader) or admin only -------------------------
drop policy if exists ownership_docs_owner_rw on storage.objects;
create policy ownership_docs_owner_rw on storage.objects
  for all to authenticated
  using (bucket_id = 'ownership-documents' and (owner = auth.uid() or public.is_admin()))
  with check (bucket_id = 'ownership-documents' and owner = auth.uid());

-- --- Public bucket: anyone reads, authenticated owner writes ----------------
drop policy if exists listing_photos_public_read on storage.objects;
create policy listing_photos_public_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'listing-photos');

drop policy if exists listing_photos_owner_write on storage.objects;
create policy listing_photos_owner_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'listing-photos' and owner = auth.uid());

drop policy if exists listing_photos_owner_modify on storage.objects;
create policy listing_photos_owner_modify on storage.objects
  for update to authenticated
  using (bucket_id = 'listing-photos' and (owner = auth.uid() or public.is_admin()));

drop policy if exists listing_photos_owner_delete on storage.objects;
create policy listing_photos_owner_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'listing-photos' and (owner = auth.uid() or public.is_admin()));
