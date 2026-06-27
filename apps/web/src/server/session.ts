import 'server-only';
import { redirect } from 'next/navigation';
import { getAuthUser } from '@markaz/auth/server';
import { resolvePostAuthDestination, type Profile, POST_AUTH_PATHS } from '@markaz/domain';
import { getServerApi } from './api';

export interface SessionContext {
  userId: string;
  email: string | null;
  profile: Profile | null;
}

/** Load the current user + profile, or null if unauthenticated. */
export async function getSession(): Promise<SessionContext | null> {
  const user = await getAuthUser();
  if (!user) return null;
  const api = await getServerApi();
  let profile: Profile | null = null;
  try {
    profile = await api.profile.get();
  } catch {
    profile = null;
  }
  return { userId: user.id, email: user.email ?? null, profile };
}

/**
 * Guard for protected customer pages. Redirects to sign-in when unauthenticated
 * and to the correct onboarding step when the profile/identity is incomplete.
 * `allow` lists the destinations this page is allowed to render for.
 */
export async function requireCustomerStep(
  locale: string,
  allow: Array<'profile-setup' | 'uae-pass' | 'dashboard'>,
): Promise<SessionContext> {
  const session = await getSession();
  if (!session) redirect(`/${locale}/sign-in`);
  const destination = resolvePostAuthDestination(session.profile);
  if (!allow.includes(destination)) {
    redirect(`/${locale}${POST_AUTH_PATHS[destination]}`);
  }
  return session;
}
