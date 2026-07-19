import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { getAuthUser } from '@markaz/auth/server';
import { loadOwnProfileRow, type Profile as ProfileRow } from '@markaz/db';
import { getServerApi } from './api';

export interface AdminSession {
  userId: string;
  email: string | null;
  profile: ProfileRow | null;
}

/** Current user + profile row, request-deduplicated. */
export const getAdminSession = cache(async (): Promise<AdminSession | null> => {
  const user = await getAuthUser();
  if (!user) return null;
  // A missing row is a valid access-denied case. Infrastructure/RLS failures
  // must remain errors rather than being misreported as a non-admin account.
  const profile = await loadOwnProfileRow({ id: user.id, email: user.email ?? undefined });
  return { userId: user.id, email: user.email ?? null, profile };
});

/**
 * Admin guard: unauthenticated → /login; authenticated non-ADMIN → /access-denied.
 * The real boundary is RLS + the ADMIN tRPC procedures; this is the app shell guard.
 */
export async function requireAdmin(locale: string): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) redirect(`/${locale}/login`);
  if (!session.profile || session.profile.accountType !== 'ADMIN') {
    // Best-effort audit of a non-admin attempt (never blocks the redirect).
    try {
      const api = await getServerApi();
      await api.audit.record({ action: 'ADMIN_ACCESS_DENIED' });
    } catch {
      /* ignore */
    }
    redirect(`/${locale}/access-denied`);
  }
  return session;
}
