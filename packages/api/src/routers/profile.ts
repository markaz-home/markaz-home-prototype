import { eq, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { profiles, auditEvents, type Tx } from '@markaz/db';
import { normalizePhoneE164, profileSetupSchema, profileUpdateSchema } from '@markaz/domain';
import { router, protectedProcedure, customerProcedure } from '../trpc';

function toProfileDto(row: typeof profiles.$inferSelect) {
  return {
    id: row.id,
    email: row.email,
    fullName: row.fullName,
    phoneE164: row.phoneE164,
    phoneVerifiedAt: row.phoneVerifiedAt?.toISOString() ?? null,
    phoneVerificationSource: row.phoneVerificationSource,
    accountType: row.accountType,
    identityVerificationStatus: row.identityVerificationStatus,
    termsAcceptedAt: row.termsAcceptedAt?.toISOString() ?? null,
    privacyAcceptedAt: row.privacyAcceptedAt?.toISOString() ?? null,
    onboardingCompletedAt: row.onboardingCompletedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function loadOwnProfile(tx: Tx, id: string) {
  const rows = await tx.select().from(profiles).where(eq(profiles.id, id)).limit(1);
  return rows[0];
}

function isUnlinkedUaePassIdentity(error: unknown): boolean {
  return error instanceof Error && error.message.includes('UAE_PASS_IDENTITY_NOT_LINKED');
}

export const profileRouter = router({
  /** The authenticated user's own profile (via RLS). */
  get: protectedProcedure.query(async ({ ctx }) => {
    const row = await loadOwnProfile(ctx.tx, ctx.user.id);
    if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'Profile not found' });
    return toProfileDto(row);
  }),

  /** First-time profile setup: full name + Terms + Privacy. Never account_type. */
  completeSetup: customerProcedure.input(profileSetupSchema).mutation(async ({ ctx, input }) => {
    const now = new Date();
    await ctx.tx
      .update(profiles)
      .set({
        fullName: input.fullName.trim(),
        termsAcceptedAt: now,
        privacyAcceptedAt: now,
        onboardingCompletedAt: now,
      })
      .where(eq(profiles.id, ctx.user.id));
    await ctx.tx.insert(auditEvents).values({
      actorId: ctx.user.id,
      action: 'ACCOUNT_PROFILE_COMPLETED',
      entityType: 'profile',
      entityId: ctx.user.id,
      metadata: {},
    });
    const row = await loadOwnProfile(ctx.tx, ctx.user.id);
    return toProfileDto(row!);
  }),

  /**
   * Edit customer-owned profile details. Mobile is optional contact data only;
   * changing it clears any prior verification provenance and never changes Auth.
   */
  update: customerProcedure.input(profileUpdateSchema).mutation(async ({ ctx, input }) => {
    const row = await loadOwnProfile(ctx.tx, ctx.user.id);
    if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'Profile not found' });

    const fullName = input.fullName.trim();
    const phoneE164 = normalizePhoneE164(input.phone);
    const updatedFields: string[] = [];
    if (row.fullName !== fullName) updatedFields.push('full_name');
    if (row.phoneE164 !== phoneE164) updatedFields.push('phone');
    if (updatedFields.length === 0) return toProfileDto(row);

    await ctx.tx
      .update(profiles)
      .set({
        fullName,
        phoneE164,
        ...(row.phoneE164 !== phoneE164
          ? { phoneVerifiedAt: null, phoneVerificationSource: null }
          : {}),
      })
      .where(eq(profiles.id, ctx.user.id));
    await ctx.tx.insert(auditEvents).values({
      actorId: ctx.user.id,
      action: 'ACCOUNT_PROFILE_UPDATED',
      entityType: 'profile',
      entityId: ctx.user.id,
      // Deliberately record field names only — never contact values.
      metadata: { fields: updatedFields },
    });

    const updated = await loadOwnProfile(ctx.tx, ctx.user.id);
    return toProfileDto(updated!);
  }),

  /**
   * Record a linked UAE PASS Staging identity without accepting a browser claim.
   * The database function derives the actor from auth.uid() and checks the
   * canonical auth.identities table before writing. Do not pre-gate this on
   * app_metadata.providers: that metadata can briefly be stale after a link.
   */
  syncUaePassIdentity: customerProcedure.mutation(async ({ ctx }) => {
    try {
      await ctx.tx.execute(sql`select public.sync_uae_pass_staging_identity()`);
    } catch (error) {
      if (isUnlinkedUaePassIdentity(error)) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'UAE PASS identity is not linked',
        });
      }
      throw error;
    }
    const row = await loadOwnProfile(ctx.tx, ctx.user.id);
    if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'Profile not found' });
    return toProfileDto(row);
  }),
});
