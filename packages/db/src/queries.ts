import { and, eq } from 'drizzle-orm';
import { isProfileComplete } from '@markaz/domain';
import { getAppDb } from './client';
import { withUserContext } from './rls-context';
import { auditEvents, profiles, type Profile } from './schema';

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

/**
 * Complete the authenticated customer's identity checkpoint in a simulated
 * environment. The transition is server-owned, profile-completeness guarded,
 * persisted, audited, and idempotent. It must never be used for UAE PASS
 * staging, where the provider-derived database workflow records
 * VERIFIED_STAGING instead.
 */
export async function completeOwnSimulatedIdentity(user: {
  id: string;
  email?: string;
}): Promise<Profile | null> {
  return withUserContext(
    getAppDb(),
    { userId: user.id, email: user.email, accountType: 'CUSTOMER' },
    async (tx) => {
      const rows = await tx
        .select()
        .from(profiles)
        .where(and(eq(profiles.id, user.id), eq(profiles.accountType, 'CUSTOMER')))
        .limit(1)
        .for('update');
      const profile = rows[0];
      if (!profile) return null;

      if (
        profile.identityVerificationStatus === 'VERIFIED_DEMO' ||
        profile.identityVerificationStatus === 'VERIFIED_STAGING' ||
        !isProfileComplete({
          fullName: profile.fullName,
          termsAcceptedAt: profile.termsAcceptedAt?.toISOString() ?? null,
          privacyAcceptedAt: profile.privacyAcceptedAt?.toISOString() ?? null,
        })
      ) {
        return profile;
      }

      const now = new Date();
      const updated = await tx
        .update(profiles)
        .set({
          identityVerificationStatus: 'VERIFIED_DEMO',
          onboardingCompletedAt: profile.onboardingCompletedAt ?? now,
          updatedAt: now,
        })
        .where(eq(profiles.id, user.id))
        .returning();

      await tx.insert(auditEvents).values({
        actorId: user.id,
        action: 'ACCOUNT_IDENTITY_VERIFIED_DEMO',
        entityType: 'profile',
        entityId: user.id,
        metadata: { mode: 'simulated', source: 'onboarding' },
      });

      return updated[0] ?? profile;
    },
  );
}
