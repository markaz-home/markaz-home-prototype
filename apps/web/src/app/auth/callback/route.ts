import { type NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@markaz/auth/server';
import { isLocale, defaultLocale } from '@markaz/i18n';
import { resolvePostSignInDestination } from '@/lib/auth-redirect';
import {
  resolveUaePassCallbackNotice,
  resolveUaePassLinkError,
  type UaePassLinkNotice,
} from '@/lib/uae-pass-link';

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
  const providerErrorCode = searchParams.get('error_code');
  const localeParam = searchParams.get('locale');
  const locale = localeParam && isLocale(localeParam) ? localeParam : defaultLocale;
  const destination = resolvePostSignInDestination(searchParams.get('next'));
  const isIdentityLink = destination === '/onboarding/uae-pass';

  const backToSignIn = (reason: string) =>
    NextResponse.redirect(new URL(`/${locale}/sign-in?error=${reason}`, origin));
  const backToIdentityStep = (notice: UaePassLinkNotice) =>
    NextResponse.redirect(new URL(`/${locale}/onboarding/uae-pass?notice=${notice}`, origin));
  const recoverFromError = (notice: UaePassLinkNotice, signInReason = 'uae_pass') =>
    isIdentityLink ? backToIdentityStep(notice) : backToSignIn(signInReason);

  if (providerError) {
    // Do not log callback query values: they are provider/user-controlled and may
    // contain sensitive detail. `access_denied` is a genuine cancellation; anything
    // else (e.g. server_error) is a failure, shown with generic copy.
    if (providerErrorCode === 'manual_linking_disabled') {
      console.warn(
        '[uae-pass] manual identity linking is disabled; enable auth.enable_manual_linking',
      );
    } else {
      console.warn('[uae-pass] provider callback returned an error');
    }
    const notice = resolveUaePassCallbackNotice(providerError, providerErrorCode);
    return recoverFromError(
      notice,
      providerError === 'access_denied' ? 'uae_pass_cancelled' : 'uae_pass',
    );
  }
  if (!code) return recoverFromError('uae_pass_error');

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    // Keep provider/auth detail out of application logs and redirects.
    console.warn('[uae-pass] code exchange failed');
    return recoverFromError(resolveUaePassLinkError(error));
  }

  if (isIdentityLink) {
    // Complete the onboarding write before leaving the callback. Previously the
    // browser had to discover the newly linked provider from app_metadata and
    // issue a second request, which could briefly be stale after identity linking.
    // The database function is idempotent and independently verifies the linked
    // auth.identities row, so a single retry is safe and never trusts a browser
    // claim.
    let syncError: unknown = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const result = await supabase.rpc('sync_uae_pass_staging_identity');
        syncError = result.error;
      } catch {
        syncError = new Error('identity sync request failed');
      }
      if (!syncError) break;
    }
    if (syncError) {
      console.warn('[uae-pass] linked identity could not be recorded');
      return backToIdentityStep('uae_pass_record_error');
    }

    // The identity result is now persisted, so complete the journey immediately.
    // A fresh server request also avoids any prefetched onboarding state.
    return NextResponse.redirect(new URL(`/${locale}/dashboard`, origin));
  }

  // Session established. The (app) guard reroutes onboarding as needed.
  return NextResponse.redirect(new URL(`/${locale}${destination}`, origin));
}
