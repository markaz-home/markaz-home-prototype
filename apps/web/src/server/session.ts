import 'server-only';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@markaz/auth/server';
import {
  resolvePostAuthDestination,
  type Profile,
  type PostAuthDestination,
  POST_AUTH_PATHS,
} from '@markaz/domain';
import { getServerApi } from './api';

export interface SessionContext {
  userId: string;
  email: string | null;
  emailVerified: boolean;
  profile: Profile | null;
}

/** Load the current user (+ email-verification state) + profile, or null. */
export async function getSession(): Promise<SessionContext | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const api = await getServerApi();
  let profile: Profile | null = null;
  try {
    profile = await api.profile.get();
  } catch {
    profile = null;
  }
  return {
    userId: user.id,
    email: user.email ?? null,
    emailVerified: !!user.email_confirmed_at,
    profile,
  };
}

/**
 * Guard for protected customer pages. Redirects to sign-in when unauthenticated
 * and to the correct onboarding step (verify-email → profile → UAE PASS) when
 * onboarding is incomplete. Unverified/incomplete customers never reach the app.
 */
export async function requireCustomerStep(
  locale: string,
  allow: PostAuthDestination[],
): Promise<SessionContext> {
  const session = await getSession();
  if (!session) redirect(`/${locale}/sign-in`);
  const destination = resolvePostAuthDestination({
    emailVerified: session.emailVerified,
    profile: session.profile,
  });
  if (!allow.includes(destination)) {
    redirect(`/${locale}${POST_AUTH_PATHS[destination]}`);
  }
  return session;
}
