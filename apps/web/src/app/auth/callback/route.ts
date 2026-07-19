import { type NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@markaz/auth/server';
import { isLocale, defaultLocale } from '@markaz/i18n';
import { resolvePostSignInDestination } from '@/lib/auth-redirect';

/**
 * OAuth code-exchange callback (PKCE). Used by the UAE PASS Staging login and any
 * future Supabase OAuth provider. Supabase Auth (GoTrue) has already completed the
 * provider round-trip and account resolution (by provider subject) and redirected
 * here with `?code=`; we exchange it for a STANDARD Supabase SSR session.
 * `auth.uid()` / RLS then work exactly as for email-password sign-in.
 *
 * On first UAE PASS sign-in the `handle_new_user` trigger creates the normal CUSTOMER
 * profile; the (app) layout guard (`requireCustomerStep`) then reroutes the user to
 * profile setup if incomplete. A Supabase-controlled `custom:uae-pass` identity
 * satisfies the old simulated UAE PASS step, so we forward to the localized
 * dashboard and let the server guard decide. Never logs the code or tokens.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const providerError = searchParams.get('error'); // e.g. access_denied (user cancelled)
  const localeParam = searchParams.get('locale');
  const locale = localeParam && isLocale(localeParam) ? localeParam : defaultLocale;
  const destination = resolvePostSignInDestination(searchParams.get('next'));

  const backToSignIn = (reason: string) =>
    NextResponse.redirect(new URL(`/${locale}/sign-in?error=${reason}`, origin));

  if (providerError) {
    // Do not log callback query values: they are provider/user-controlled and may
    // contain sensitive detail. `access_denied` is a genuine cancellation; anything
    // else (e.g. server_error) is a failure, shown with generic copy.
    console.warn('[uae-pass] provider callback returned an error');
    return backToSignIn(providerError === 'access_denied' ? 'uae_pass_cancelled' : 'uae_pass');
  }
  if (!code) return backToSignIn('uae_pass');

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.warn(`[uae-pass] code exchange failed: ${error.message}`);
    return backToSignIn('uae_pass');
  }

  // Session established. The (app) guard reroutes onboarding as needed.
  return NextResponse.redirect(new URL(`/${locale}${destination}`, origin));
}
