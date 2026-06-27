import createIntlMiddleware from 'next-intl/middleware';
import type { NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { routing } from '@markaz/i18n';
import { getPublicSupabaseConfig } from '@markaz/auth';

type CookieToSet = { name: string; value: string; options?: CookieOptions };

const intlMiddleware = createIntlMiddleware(routing);

/**
 * Combined middleware:
 *  1. next-intl locale routing (/en, /ar).
 *  2. Supabase session refresh — rotated auth cookies are written onto the
 *     intl response. Route protection itself is enforced server-side per page;
 *     RLS is the real security boundary (client guards are UX only).
 */
export async function middleware(request: NextRequest) {
  const response = intlMiddleware(request);

  const { url, anonKey } = getPublicSupabaseConfig();
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });
  await supabase.auth.getUser();

  return response;
}

export const config = {
  // Skip API, static assets, and files with extensions.
  matcher: ['/((?!api|auth|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
