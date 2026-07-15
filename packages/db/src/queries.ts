import { eq } from 'drizzle-orm';
import { getAppDb } from './client';
import { withUserContext } from './rls-context';
import { profiles, type Profile } from './schema';

/** Load the authenticated user's own profile row under RLS (single query). */
export async function loadOwnProfileRow(user: {
  id: string;
  email?: string;
}): Promise<Profile | null> {
  return withUserContext(
    getAppDb(),
    { userId: user.id, email: user.email, accountType: 'CUSTOMER' },
    async (tx) => {
      const rows = await tx.select().from(profiles).where(eq(profiles.id, user.id)).limit(1);
      return rows[0] ?? null;
    },
  );
}
