-- Week 5 — add transaction streams to Supabase Realtime (participant-scoped by RLS).
-- The client refetches authoritative state on any event (ADR-0018 pattern); the payload
-- is never trusted. Anonymous subscribers receive nothing (no grant/policy).
do $$
begin
  begin
    alter publication supabase_realtime add table public.transaction_events;
  exception when duplicate_object then null; end;
  begin
    alter publication supabase_realtime add table public.transactions;
  exception when duplicate_object then null; end;
end $$;
