import { type NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@markaz/auth/server';
import { loadOwnProfileRow } from '@markaz/db';
import { isProfileComplete } from '@markaz/domain';
import { isLocale, defaultLocale } from '@markaz/i18n';
import { resolvePostSignInDestination } from '@/lib/auth-redirect';
import {
  resolveUaePassLinkError,
  resolveUaePassProfileCallbackNotice,
  type UaePassProfileNotice,
} from '@/lib/uae-pass-link';

/**
 * OAuth code-exchange callback (PKCE). Used by UAE PASS and Google. Supabase Auth
 * (GoTrue) has already completed the
 * provider round-trip and account resolution (by provider subject) and redirected
 * here with `?code=`; we exchange it for a STANDARD Supabase SSR session.
 * `auth.uid()` / RLS then work exactly as for email-password sign-in.
 *
 * A provider subject may resolve an existing user or create a new CUSTOMER. New
 * users are sent through profile completion for MARKAZ consent/missing details.
 * Never logs the code, token, provider attributes, email, or phone.
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
  const isSignUpIntent = searchParams.get('intent') === 'sign-up';
  const providerParam = searchParams.get('provider');
  const provider =
    providerParam === 'uae-pass' || providerParam === 'google' ? providerParam : null;

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
    console.warn('[auth-provider] callback returned an error');
    if (isIdentityLink) {
      return backToProfile(resolveUaePassProfileCallbackNotice(providerError, providerErrorCode));
    }
    return backToSignIn(
      providerErrorCode === 'identity_already_exists'
        ? 'provider_conflict'
        : providerError === 'access_denied' &&
            providerErrorDescription !== 'MARKAZ_UAE_PASS_NOT_LINKED'
          ? 'provider_cancelled'
          : 'provider_error',
    );
  }
  if (!code)
    return isIdentityLink ? backToProfile('uae_pass_error') : backToSignIn('provider_error');

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    // Keep provider/auth detail out of application logs and redirects.
    console.warn('[auth-provider] code exchange failed');
    return isIdentityLink
      ? backToProfile(resolveUaePassLinkError(error))
      : backToSignIn(
          'code' in error && error.code === 'identity_already_exists'
            ? 'provider_conflict'
            : 'provider_error',
        );
  }

  if (isIdentityLink) {
    // The successful code exchange is the canonical account-link result: GoTrue
    // has persisted the provider identity on this existing Auth user. Profile
    // records are synchronized after Profile renders so a transient database lock
    // cannot hold this callback open or misreport a completed link as a failure.
    return backToProfile('uae_pass_linked');
  }

  if (isSignUpIntent) {
    // Sign-up-page entry that resolved to an ESTABLISHED customer (profile
    // complete: name + both consents). Per the 2026-08-07 ADR-0033 refinement,
    // an established account never re-enters sign-up: end this session and send
    // them to Sign In with a clear notice. Detection uses only the authenticated
    // user's own RLS-scoped profile — never a browser-supplied email or phone.
    // Incomplete accounts (e.g. an abandoned first attempt) continue onboarding.
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const profile = await loadOwnProfileRow({ id: user.id, email: user.email ?? undefined });
      if (
        profile &&
        isProfileComplete({
          fullName: profile.fullName,
          termsAcceptedAt: profile.termsAcceptedAt?.toISOString() ?? null,
          privacyAcceptedAt: profile.privacyAcceptedAt?.toISOString() ?? null,
        })
      ) {
        await supabase.auth.signOut();
        return backToSignIn('already_registered');
      }
    }
  }

  if (provider === 'uae-pass') {
    // Fill only missing profile attributes from the canonical Auth identity and
    // record the staging verification result. This RPC derives auth.uid(); it
    // does not trust callback query data and does not use a service-role client.
    const { error: syncError } = await supabase.rpc('sync_uae_pass_staging_identity');
    if (syncError) {
      // Auth/session creation already succeeded. Profile can retry the idempotent
      // sync, so a transient database error must not strand the customer here.
      console.warn('[uae-pass] provider profile synchronization deferred');
    }
  }

  // Session established. The (app) guard reroutes onboarding as needed.
  return NextResponse.redirect(new URL(`/${locale}${destination}`, origin));
}
