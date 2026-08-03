-- Keep the secondary UAE PASS profile/audit synchronization recoverable.
-- Supabase Auth is the canonical identity-link store; Profile retries this
-- function after rendering. A row lock must therefore fail quickly instead of
-- holding the OAuth callback/request until PostgREST kills it.
alter function public.sync_uae_pass_staging_identity()
  set lock_timeout = '2s';
