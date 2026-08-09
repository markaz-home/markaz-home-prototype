import { isProfileComplete, type Profile } from './profile';

/** Logical post-authentication destinations (locale prefix added by the app). */
export type PostAuthDestination = 'verify-email' | 'profile-setup' | 'dashboard';

export const POST_AUTH_PATHS: Record<PostAuthDestination, string> = {
  'verify-email': '/verify-email',
  'profile-setup': '/onboarding/profile',
  dashboard: '/dashboard',
};

export interface PostAuthState {
  /** Whether the Supabase Auth email is confirmed (user.email_confirmed_at). */
  emailVerified: boolean;
  /** A successful trusted OAuth authentication can start onboarding without a password email. */
  providerAuthenticated?: boolean;
  profile: Pick<
    Profile,
    'fullName' | 'termsAcceptedAt' | 'privacyAcceptedAt' | 'identityVerificationStatus'
  > | null;
}

/**
 * Decide where an authenticated user should land. Centralised + fully tested.
 *
 *   email/password email not verified → verify-email
 *   provider-authenticated or email-verified, profile incomplete → profile-setup
 *   provider-authenticated or email-verified, profile complete → dashboard
 *
 * UAE PASS is an optional account-creation/sign-in method. Its provider
 * authentication replaces the password-email gate, but never replaces
 * MARKAZ profile completion or Terms/Privacy consent.
 */
export function resolvePostAuthDestination(state: PostAuthState): PostAuthDestination {
  if (!state.emailVerified && !state.providerAuthenticated) return 'verify-email';
  if (!state.profile || !isProfileComplete(state.profile)) return 'profile-setup';
  return 'dashboard';
}

/** Convenience: full locale-prefixed path for a destination. */
export function postAuthPath(locale: string, destination: PostAuthDestination): string {
  return `/${locale}${POST_AUTH_PATHS[destination]}`;
}
