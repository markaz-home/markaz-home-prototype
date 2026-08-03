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
  profile: Pick<
    Profile,
    'fullName' | 'termsAcceptedAt' | 'privacyAcceptedAt' | 'identityVerificationStatus'
  > | null;
}

/**
 * Decide where an authenticated user should land. Centralised + fully tested.
 *
 *   email/password email not verified → verify-email
 *   verified, profile incomplete → profile-setup (fallback; normal path fills it at sign-up)
 *   verified, profile complete → dashboard
 *
 * UAE PASS remains an optional sign-in provider, not a post-sign-up onboarding
 * requirement. It can only be linked to an existing email-verified account, so
 * every customer session follows the same email-verification boundary.
 */
export function resolvePostAuthDestination(state: PostAuthState): PostAuthDestination {
  if (!state.emailVerified) return 'verify-email';
  if (!state.profile || !isProfileComplete(state.profile)) return 'profile-setup';
  return 'dashboard';
}

/** Convenience: full locale-prefixed path for a destination. */
export function postAuthPath(locale: string, destination: PostAuthDestination): string {
  return `/${locale}${POST_AUTH_PATHS[destination]}`;
}
