import { isProfileComplete, type Profile } from './profile';
import { isIdentityVerified } from './identity';

/** Logical post-authentication destinations (locale prefix added by the app). */
export type PostAuthDestination = 'verify-email' | 'profile-setup' | 'uae-pass' | 'dashboard';

export const POST_AUTH_PATHS: Record<PostAuthDestination, string> = {
  'verify-email': '/verify-email',
  'profile-setup': '/onboarding/profile',
  'uae-pass': '/onboarding/uae-pass',
  dashboard: '/dashboard',
};

export interface PostAuthState {
  /** Whether the Supabase Auth email is confirmed (user.email_confirmed_at). */
  emailVerified: boolean;
  /**
   * A trusted external identity provider already authenticated this session.
   * The web app derives this from Supabase-controlled app_metadata, never from
   * editable user metadata or a client-supplied value.
   */
  identityAuthenticatedByProvider?: boolean;
  profile: Pick<
    Profile,
    'fullName' | 'termsAcceptedAt' | 'privacyAcceptedAt' | 'identityVerificationStatus'
  > | null;
}

/**
 * Decide where an authenticated user should land. Centralised + fully tested.
 *
 *   email not verified            → verify-email
 *   verified, profile incomplete  → profile-setup (fallback; normal path fills it at sign-up)
 *   verified, complete, identity NOT_STARTED/PENDING/FAILED_DEMO → uae-pass (resumes sub-state)
 *   verified, complete, VERIFIED_DEMO or trusted provider identity → dashboard
 *
 * Unverified or incomplete customers can never reach the dashboard.
 */
export function resolvePostAuthDestination(state: PostAuthState): PostAuthDestination {
  if (!state.emailVerified) return 'verify-email';
  if (!state.profile || !isProfileComplete(state.profile)) return 'profile-setup';
  if (
    !state.identityAuthenticatedByProvider &&
    !isIdentityVerified(state.profile.identityVerificationStatus)
  )
    return 'uae-pass';
  return 'dashboard';
}

/** Convenience: full locale-prefixed path for a destination. */
export function postAuthPath(locale: string, destination: PostAuthDestination): string {
  return `/${locale}${POST_AUTH_PATHS[destination]}`;
}
