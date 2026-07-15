-- =============================================================================
-- MARKAZ Home — canonical migration 08.3: publication + marketplace security
-- Closes three Week 3 boundary gaps. Forward-only.
--   1. Public listing-photos bucket: customers may READ published photos but may
--      no longer INSERT / UPDATE / DELETE objects. Only the server-side
--      publication service (service-role) writes here (ADR-0012).
--   2. property_photos.public_path may only be written by a privileged server
--      role — a customer can prepare DRAFT photos but can never decide or supply
--      a PUBLIC object path (defence in depth behind the projection / view).
--   3. saved_properties: self-save, non-LIVE save, and cross-user rows are now
--      blocked at the database boundary (RLS WITH CHECK), not only in the API.
-- =============================================================================

-- --- 1. Public photo bucket is read-only for customers ------------------------
-- Drop the customer write policies added in migration 08; KEEP public read.
-- The publication pipeline uses the service-role key, which bypasses RLS, so the
-- copy/cleanup path is unaffected. Draft photos + ownership documents keep their
-- own PRIVATE buckets and policies (migration 07) — untouched here.
drop policy if exists listing_photos_owner_write  on storage.objects;
drop policy if exists listing_photos_owner_modify on storage.objects;
drop policy if exists listing_photos_owner_delete on storage.objects;

-- --- 2. public_path is server-only -------------------------------------------
-- A customer keeps full control of their DRAFT photo metadata (register, reorder,
-- cover, delete) but can never set or change the PUBLIC object path. Only the
-- elevated publication service (service_role) or a migration/seed (postgres) may.
create or replace function public.guard_public_photo_path()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' and new.public_path is not null then
      raise exception 'property_photos.public_path is set only by the publication service'
        using errcode = 'check_violation';
    elsif tg_op = 'UPDATE' and new.public_path is distinct from old.public_path then
      raise exception 'property_photos.public_path is modified only by the publication service'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists guard_public_photo_path on public.property_photos;
create trigger guard_public_photo_path
  before insert or update on public.property_photos
  for each row execute function public.guard_public_photo_path();

-- --- 3. saved_properties: LIVE-only, never-own, own-rows-only -----------------
-- Replace the single permissive policy with per-command policies. A save is valid
-- only when the row belongs to the caller AND the listing is LIVE AND not owned by
-- the caller (mirrors the offers_insert_own rule). Reads/removes stay own-rows.
drop policy if exists saved_properties_owner on public.saved_properties;

drop policy if exists saved_properties_select on public.saved_properties;
create policy saved_properties_select on public.saved_properties
  for select using (customer_id = auth.uid());

drop policy if exists saved_properties_insert on public.saved_properties;
create policy saved_properties_insert on public.saved_properties
  for insert with check (
    customer_id = auth.uid()
    and exists (
      select 1 from public.listings l
      where l.id = saved_properties.listing_id
        and l.state = 'LIVE'
        and l.owner_id <> auth.uid()
    )
  );

-- Updates must keep the row own AND still satisfy the LIVE/not-own rule so the
-- listing reference cannot be swapped to bypass the insert check.
drop policy if exists saved_properties_update on public.saved_properties;
create policy saved_properties_update on public.saved_properties
  for update using (customer_id = auth.uid())
  with check (
    customer_id = auth.uid()
    and exists (
      select 1 from public.listings l
      where l.id = saved_properties.listing_id
        and l.state = 'LIVE'
        and l.owner_id <> auth.uid()
    )
  );

drop policy if exists saved_properties_delete on public.saved_properties;
create policy saved_properties_delete on public.saved_properties
  for delete using (customer_id = auth.uid());

-- Admin may read saved rows for support (parity with other tables).
drop policy if exists saved_properties_admin on public.saved_properties;
create policy saved_properties_admin on public.saved_properties
  for all using (public.is_admin()) with check (public.is_admin());
