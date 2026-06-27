import { createBrowserClient } from '@supabase/ssr';
import { getPublicSupabaseConfig } from './env';

/**
 * Browser Supabase client. Uses the public anon key only — never a privileged
 * key. Session tokens are managed by @supabase/ssr via secure cookies, never
 * hand-stored in Zustand/localStorage.
 */
export function createSupabaseBrowserClient() {
  const { url, anonKey } = getPublicSupabaseConfig();
  return createBrowserClient(url, anonKey);
}
