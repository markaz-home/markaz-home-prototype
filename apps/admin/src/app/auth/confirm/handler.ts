import { type NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@markaz/auth/server';
import { defaultLocale, isLocale, type Locale } from '@markaz/i18n';

function resolveLocale(url: URL, routeLocale?: string): Locale {
  if (routeLocale && isLocale(routeLocale)) return routeLocale;
  const queryLocale = url.searchParams.get('locale');
  if (queryLocale && isLocale(queryLocale)) return queryLocale;
  const nextLocale = url.searchParams.get('next')?.split('/')[1];
  return nextLocale && isLocale(nextLocale) ? nextLocale : defaultLocale;
}

export async function handleRecoveryConfirmation(request: NextRequest, routeLocale?: string) {
  const url = new URL(request.url);
  const { searchParams, origin } = url;
  const locale = resolveLocale(url, routeLocale);
  const tokenHash = searchParams.get('token_hash');

  if (tokenHash && searchParams.get('type') === 'recovery') {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.verifyOtp({
      type: 'recovery',
      token_hash: tokenHash,
    });
    if (!error) return NextResponse.redirect(new URL(`/${locale}/reset-password`, origin));
  }

  return NextResponse.redirect(new URL(`/${locale}/reset-password?error=invalid`, origin));
}
