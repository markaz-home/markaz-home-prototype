import { type NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@markaz/auth/server';
import { defaultLocale, isLocale, type Locale } from '@markaz/i18n';

function localeFromLegacyNext(next: string | null): Locale | null {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return null;
  const candidate = next.split('/')[1];
  return candidate && isLocale(candidate) ? candidate : null;
}

/**
 * Resolve only the locale from callback input. The destination itself is fixed,
 * so an email-controlled `next` value can never become an open redirect.
 */
export function resolveRecoveryLocale(url: URL, routeLocale?: string): Locale {
  if (routeLocale && isLocale(routeLocale)) return routeLocale;
  const queryLocale = url.searchParams.get('locale');
  if (queryLocale && isLocale(queryLocale)) return queryLocale;
  return localeFromLegacyNext(url.searchParams.get('next')) ?? defaultLocale;
}

export async function handleRecoveryConfirmation(request: NextRequest, routeLocale?: string) {
  const url = new URL(request.url);
  const { searchParams, origin } = url;
  const locale = resolveRecoveryLocale(url, routeLocale);
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type');

  if (tokenHash && type === 'recovery') {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.verifyOtp({ type: 'recovery', token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(new URL(`/${locale}/reset-password`, origin));
    }
  }

  return NextResponse.redirect(new URL(`/${locale}/reset-password?error=invalid`, origin));
}
