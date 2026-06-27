-- =============================================================================
-- MARKAZ Home — canonical migration 03: marketplace RLS + grants
-- RLS is the primary authorisation boundary (§10). Every policy is tested.
-- =============================================================================

-- Enforce "no offer on your own listing" at the database (§6A.6), independent
-- of the API. SECURITY DEFINER so it can read the listing owner regardless of
-- the calling role's row visibility.
create or replace function public.enforce_offer_not_on_own_listing()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  select owner_id into v_owner from public.listings where id = new.listing_id;
  if v_owner is not null and v_owner = new.created_by then
    raise exception 'a customer cannot submit an offer on a listing they own'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists offers_not_on_own_listing on public.offers;
create trigger offers_not_on_own_listing
  before insert on public.offers
  for each row execute function public.enforce_offer_not_on_own_listing();

-- --- Enable + force RLS on every marketplace table ---------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'properties','listings','ownership_documents','verifications','form_a_records',
    'permit_records','property_photos','saved_properties','saved_searches',
    'offers','counter_offers','transactions','transaction_stage_history',
    'notifications','audit_events'
  ] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('alter table public.%I force row level security;', t);
  end loop;
end $$;

-- --- Properties --------------------------------------------------------------
drop policy if exists properties_owner_all on public.properties;
create policy properties_owner_all on public.properties
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists properties_admin_all on public.properties;
create policy properties_admin_all on public.properties
  for all using (public.is_admin()) with check (public.is_admin());

-- --- Listings ----------------------------------------------------------------
-- Public (anon + authenticated) may read only LIVE listings.
drop policy if exists listings_public_live on public.listings;
create policy listings_public_live on public.listings
  for select using (state = 'LIVE');
-- Owners read/write their own listings in any state.
drop policy if exists listings_owner_all on public.listings;
create policy listings_owner_all on public.listings
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists listings_admin_all on public.listings;
create policy listings_admin_all on public.listings
  for all using (public.is_admin()) with check (public.is_admin());

-- --- Ownership documents (PRIVATE — owner or admin only) --------------------
drop policy if exists ownership_docs_owner on public.ownership_documents;
create policy ownership_docs_owner on public.ownership_documents
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists ownership_docs_admin on public.ownership_documents;
create policy ownership_docs_admin on public.ownership_documents
  for all using (public.is_admin()) with check (public.is_admin());

-- --- Listing-scoped operational tables (owner of listing or admin) ----------
do $$
declare t text;
begin
  foreach t in array array['verifications','form_a_records','permit_records','property_photos'] loop
    execute format($f$
      drop policy if exists %1$s_owner on public.%1$s;
      create policy %1$s_owner on public.%1$s for all
        using (exists (select 1 from public.listings l where l.id = %1$s.listing_id and l.owner_id = auth.uid()))
        with check (exists (select 1 from public.listings l where l.id = %1$s.listing_id and l.owner_id = auth.uid()));
      drop policy if exists %1$s_admin on public.%1$s;
      create policy %1$s_admin on public.%1$s for all
        using (public.is_admin()) with check (public.is_admin());
    $f$, t);
  end loop;
end $$;

-- property_photos for a LIVE listing are publicly readable (metadata).
drop policy if exists property_photos_public_live on public.property_photos;
create policy property_photos_public_live on public.property_photos
  for select using (exists (
    select 1 from public.listings l where l.id = property_photos.listing_id and l.state = 'LIVE'
  ));

-- --- Saved items (owner only) -----------------------------------------------
drop policy if exists saved_properties_owner on public.saved_properties;
create policy saved_properties_owner on public.saved_properties
  for all using (customer_id = auth.uid()) with check (customer_id = auth.uid());
drop policy if exists saved_searches_owner on public.saved_searches;
create policy saved_searches_owner on public.saved_searches
  for all using (customer_id = auth.uid()) with check (customer_id = auth.uid());

-- --- Offers ------------------------------------------------------------------
-- Visible to the offering customer, the listing owner, and admin.
drop policy if exists offers_visibility on public.offers;
create policy offers_visibility on public.offers
  for select using (
    created_by = auth.uid()
    or exists (select 1 from public.listings l where l.id = offers.listing_id and l.owner_id = auth.uid())
    or public.is_admin()
  );
-- Only the offering customer creates an offer, and never on a listing they own.
drop policy if exists offers_insert_own on public.offers;
create policy offers_insert_own on public.offers
  for insert with check (
    created_by = auth.uid()
    and not exists (select 1 from public.listings l where l.id = offers.listing_id and l.owner_id = auth.uid())
  );
-- Offering customer or listing owner may update (transitions constrained by API).
drop policy if exists offers_update_participant on public.offers;
create policy offers_update_participant on public.offers
  for update using (
    created_by = auth.uid()
    or exists (select 1 from public.listings l where l.id = offers.listing_id and l.owner_id = auth.uid())
  );
drop policy if exists offers_admin_all on public.offers;
create policy offers_admin_all on public.offers
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists counter_offers_participant on public.counter_offers;
create policy counter_offers_participant on public.counter_offers
  for all using (exists (
    select 1 from public.offers o
    join public.listings l on l.id = o.listing_id
    where o.id = counter_offers.offer_id
      and (o.created_by = auth.uid() or l.owner_id = auth.uid())
  )) with check (created_by = auth.uid());

-- --- Transactions (buyer, seller, admin only) -------------------------------
drop policy if exists transactions_participants on public.transactions;
create policy transactions_participants on public.transactions
  for select using (buyer_id = auth.uid() or seller_id = auth.uid() or public.is_admin());
drop policy if exists transactions_admin_write on public.transactions;
create policy transactions_admin_write on public.transactions
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists tx_history_participants on public.transaction_stage_history;
create policy tx_history_participants on public.transaction_stage_history
  for select using (exists (
    select 1 from public.transactions t
    where t.id = transaction_stage_history.transaction_id
      and (t.buyer_id = auth.uid() or t.seller_id = auth.uid() or public.is_admin())
  ));

-- --- Notifications (recipient only) -----------------------------------------
drop policy if exists notifications_recipient on public.notifications;
create policy notifications_recipient on public.notifications
  for select using (recipient_id = auth.uid() or public.is_admin());
drop policy if exists notifications_update_recipient on public.notifications;
create policy notifications_update_recipient on public.notifications
  for update using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

-- --- Audit events (insert-only from app; admin reads) -----------------------
drop policy if exists audit_admin_read on public.audit_events;
create policy audit_admin_read on public.audit_events
  for select using (public.is_admin());
drop policy if exists audit_insert on public.audit_events;
create policy audit_insert on public.audit_events
  for insert with check (actor_id = auth.uid() or public.is_admin());

-- --- Grants (RLS still gates rows) ------------------------------------------
grant select on public.listings, public.property_photos to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
