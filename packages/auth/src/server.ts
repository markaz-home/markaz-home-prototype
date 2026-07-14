import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { getPublicSupabaseConfig } from './env';

type CookieToSet = { name: string; value: string; options?: CookieOptions };

/**
 * Server Supabase client for React Server Components, Route Handlers and tRPC.
 * Reads/writes the session via Next cookies (secure, httpOnly). Uses the anon
 * key + the user's session — never the service-role key for user requests.
 */
export async function createSupabaseServerClient() {
  const { url, anonKey } = getPublicSupabaseConfig();
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component where cookies are read-only.
          // Session refresh is handled by the middleware instead.
        }
      },
    },
  });
}

/**
 * Returns the validated authenticated user (or null). `getUser()` re-validates
 * the JWT against the Supabase Auth server — do not trust getSession() alone
 * for authorization decisions.
 */
export async function getAuthUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
