import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient, getAuthProviderIds } from '@markaz/auth/server';
import { loadOwnProfileRow, type Profile as ProfileRow } from '@markaz/db';
import {
  resolvePostAuthDestination,
  type Profile,
  type PostAuthDestination,
  POST_AUTH_PATHS,
} from '@markaz/domain';

export interface SessionContext {
  userId: string;
  email: string | null;
  emailVerified: boolean;
  uaePassAuthenticated: boolean;
  profile: Profile | null;
}

function toProfileDto(row: ProfileRow): Profile {
  return {
    id: row.id,
    email: row.email,
    fullName: row.fullName,
    accountType: row.accountType,
    identityVerificationStatus: row.identityVerificationStatus,
    termsAcceptedAt: row.termsAcceptedAt?.toISOString() ?? null,
    privacyAcceptedAt: row.privacyAcceptedAt?.toISOString() ?? null,
    onboardingCompletedAt: row.onboardingCompletedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Load the current user (+ email-verification state) + profile, or null.
 *
 * Wrapped in React `cache()` so the layout guard and the page that follows it
 * share a SINGLE auth check + profile query per request (instead of repeating
 * `getUser` and DB work several times — the main source of the post-sign-in lag).
 * Reads the profile directly under RLS rather than through the tRPC stack.
 */
export const getSession = cache(async (): Promise<SessionContext | null> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const row = await loadOwnProfileRow({ id: user.id, email: user.email ?? undefined });
  // A genuine missing row remains the onboarding fallback. Operational DB/RLS
  // failures must propagate to the route error boundary instead of masquerading
  // as a new customer with no profile.
  const profile = row ? toProfileDto(row) : null;

  return {
    userId: user.id,
    email: user.email ?? null,
    emailVerified: !!user.email_confirmed_at,
    // app_metadata is controlled by Supabase Auth. Do not derive this security
    // decision from editable user_metadata or from a browser-provided flag.
    uaePassAuthenticated: getAuthProviderIds(user).includes('custom:uae-pass'),
    profile,
  };
});

/**
 * Guard for protected customer pages. Redirects to sign-in when unauthenticated
 * and to the correct onboarding step when onboarding is incomplete.
 */
export async function requireCustomerStep(
  locale: string,
  allow: PostAuthDestination[],
): Promise<SessionContext> {
  const session = await getSession();
  if (!session) redirect(`/${locale}/sign-in`);
  const destination = resolvePostAuthDestination({
    emailVerified: session.emailVerified,
    identityAuthenticatedByProvider: session.uaePassAuthenticated,
    profile: session.profile,
  });
  if (!allow.includes(destination)) {
    redirect(`/${locale}${POST_AUTH_PATHS[destination]}`);
  }
  return session;
}
