-- =============================================================================
-- MARKAZ Home — canonical migration 05: Realtime proof scaffold (Step 15)
-- A tiny shared-counter table used only to prove cross-session Realtime.
-- Production rule: Realtime connects DIRECT to the database, never via a pooler.
-- =============================================================================

create table if not exists public.realtime_counters (
  id text primary key,
  value integer not null default 0,
  updated_at timestamptz not null default now()
);

insert into public.realtime_counters (id, value)
values ('demo', 0)
on conflict (id) do nothing;

alter table public.realtime_counters enable row level security;

-- Any authenticated session may read and increment the demo counter.
drop policy if exists realtime_counters_read on public.realtime_counters;
create policy realtime_counters_read on public.realtime_counters
  for select to authenticated using (true);

drop policy if exists realtime_counters_update on public.realtime_counters;
create policy realtime_counters_update on public.realtime_counters
  for update to authenticated using (true) with check (true);

grant select, update on public.realtime_counters to authenticated;

-- Publish row changes to the Supabase Realtime stream.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'realtime_counters'
  ) then
    execute 'alter publication supabase_realtime add table public.realtime_counters';
  end if;
exception when undefined_object then
  -- publication not present (non-Supabase Postgres in tests) — safe to skip.
  null;
end $$;
