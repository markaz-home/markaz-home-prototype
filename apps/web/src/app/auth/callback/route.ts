import { type NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@markaz/auth/server';
import { isLocale, defaultLocale } from '@markaz/i18n';
import { resolvePostSignInDestination } from '@/lib/auth-redirect';
import {
  isUnlinkedUaePassCallback,
  resolveUaePassLinkError,
  resolveUaePassProfileCallbackNotice,
  type UaePassProfileNotice,
} from '@/lib/uae-pass-link';

/**
 * OAuth code-exchange callback (PKCE). Used by the UAE PASS Staging login and any
 * future Supabase OAuth provider. Supabase Auth (GoTrue) has already completed the
 * provider round-trip and account resolution (by provider subject) and redirected
 * here with `?code=`; we exchange it for a STANDARD Supabase SSR session.
 * `auth.uid()` / RLS then work exactly as for email-password sign-in.
 *
 * UAE PASS is login-only for identities explicitly linked from the authenticated
 * Profile page. The Before User Created hook rejects unknown provider subjects,
 * preventing hidden email-less users. Never logs the code or tokens.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const providerError = searchParams.get('error'); // e.g. access_denied (user cancelled)
  const providerErrorCode = searchParams.get('error_code');
  const providerErrorDescription = searchParams.get('error_description');
  const localeParam = searchParams.get('locale');
  const locale = localeParam && isLocale(localeParam) ? localeParam : defaultLocale;
  const destination = resolvePostSignInDestination(searchParams.get('next'));
  const isIdentityLink = searchParams.get('flow') === 'link';

  const backToSignIn = (reason: string, next?: string) => {
    const params = new URLSearchParams({ error: reason });
    if (next) params.set('next', next);
    return NextResponse.redirect(new URL(`/${locale}/sign-in?${params.toString()}`, origin));
  };
  const backToProfile = (notice: UaePassProfileNotice) =>
    NextResponse.redirect(new URL(`/${locale}/account/profile?uae_pass=${notice}`, origin));

  if (providerError) {
    // Do not log callback query values: they are provider/user-controlled and may
    // contain sensitive detail. `access_denied` is a genuine cancellation; anything
    // else (e.g. server_error) is a failure, shown with generic copy.
    if (!isIdentityLink && isUnlinkedUaePassCallback(providerErrorDescription)) {
      return backToSignIn('uae_pass_not_linked', '/account/profile');
    }
    console.warn('[uae-pass] provider callback returned an error');
    if (isIdentityLink) {
      return backToProfile(resolveUaePassProfileCallbackNotice(providerError, providerErrorCode));
    }
    return backToSignIn(providerError === 'access_denied' ? 'uae_pass_cancelled' : 'uae_pass');
  }
  if (!code) return isIdentityLink ? backToProfile('uae_pass_error') : backToSignIn('uae_pass');

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    // Keep provider/auth detail out of application logs and redirects.
    console.warn('[uae-pass] code exchange failed');
    return isIdentityLink
      ? backToProfile(resolveUaePassLinkError(error))
      : backToSignIn('uae_pass');
  }

  if (isIdentityLink) {
    // The successful code exchange is the canonical account-link result: GoTrue
    // has persisted the provider identity on this existing Auth user. Profile
    // records are synchronized after Profile renders so a transient database lock
    // cannot hold this callback open or misreport a completed link as a failure.
    return backToProfile('uae_pass_linked');
  }

  // Session established. The (app) guard reroutes onboarding as needed.
  return NextResponse.redirect(new URL(`/${locale}${destination}`, origin));
}
