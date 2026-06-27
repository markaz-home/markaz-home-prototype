import { isProfileComplete, type Profile } from './profile';
import { isIdentityVerified } from './identity';

/** Logical post-authentication destinations (locale prefix added by the app). */
export type PostAuthDestination = 'profile-setup' | 'uae-pass' | 'dashboard';

export const POST_AUTH_PATHS: Record<PostAuthDestination, string> = {
  'profile-setup': '/onboarding/profile',
  'uae-pass': '/onboarding/uae-pass',
  dashboard: '/dashboard',
};

/**
 * Decide where an authenticated CUSTOMER should land.
 *
 * New customer        → profile setup → simulated UAE PASS → dashboard.
 * Returning customer  → (skip completed steps) → dashboard.
 *
 * A returning customer whose profile is complete and whose identity status is
 * VERIFIED_DEMO skips both onboarding screens. Pure + fully unit-tested.
 */
export function resolvePostAuthDestination(
  profile: Pick<
    Profile,
    'fullName' | 'termsAcceptedAt' | 'privacyAcceptedAt' | 'identityVerificationStatus'
  > | null,
): PostAuthDestination {
  // No profile row yet (brand-new auth user) → must complete setup.
  if (!profile) return 'profile-setup';
  if (!isProfileComplete(profile)) return 'profile-setup';
  if (!isIdentityVerified(profile.identityVerificationStatus)) return 'uae-pass';
  return 'dashboard';
}

/** Convenience: full locale-prefixed path for a destination. */
export function postAuthPath(locale: string, destination: PostAuthDestination): string {
  return `/${locale}${POST_AUTH_PATHS[destination]}`;
}
