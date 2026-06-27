import 'server-only';
import { redirect } from 'next/navigation';
import { getAuthUser } from '@markaz/auth/server';
import type { Profile } from '@markaz/domain';
import { getServerApi } from './api';

export interface AdminSession {
  userId: string;
  email: string | null;
  profile: Profile | null;
}

async function loadProfile(): Promise<Profile | null> {
  const api = await getServerApi();
  try {
    return await api.profile.get();
  } catch {
    return null;
  }
}

/** Current user + profile, or null user. */
export async function getAdminSession(): Promise<AdminSession | null> {
  const user = await getAuthUser();
  if (!user) return null;
  return { userId: user.id, email: user.email ?? null, profile: await loadProfile() };
}

/**
 * Admin guard: unauthenticated → /login; authenticated non-ADMIN → /access-denied.
 * The real boundary is RLS + the ADMIN tRPC procedures; this is the app shell guard.
 */
export async function requireAdmin(locale: string): Promise<AdminSession> {
  const user = await getAuthUser();
  if (!user) redirect(`/${locale}/login`);
  const profile = await loadProfile();
  if (!profile || profile.accountType !== 'ADMIN') {
    // Best-effort audit of a non-admin attempt (never blocks the redirect).
    try {
      const api = await getServerApi();
      await api.audit.record({ action: 'ADMIN_ACCESS_DENIED' });
    } catch {
      /* ignore */
    }
    redirect(`/${locale}/access-denied`);
  }
  return { userId: user.id, email: user.email ?? null, profile };
}
