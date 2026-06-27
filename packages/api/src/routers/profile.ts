import { eq, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { profiles, type Tx } from '@markaz/db';
import {
  profileSetupSchema,
  identityStatusSchema,
  canTransitionIdentity,
  type IdentityVerificationStatus,
} from '@markaz/domain';
import { router, protectedProcedure, customerProcedure } from '../trpc';

function toProfileDto(row: typeof profiles.$inferSelect) {
  return {
    id: row.id,
    email: row.email,
    fullName: row.fullName,
    accountType: row.accountType,
    identityVerificationStatus: row.identityVerificationStatus,
    termsAcceptedAt: row.termsAcceptedAt?.toISOString() ?? null,
    privacyAcceptedAt: row.privacyAcceptedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function loadOwnProfile(tx: Tx, id: string) {
  const rows = await tx.select().from(profiles).where(eq(profiles.id, id)).limit(1);
  return rows[0];
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
      })
      .where(eq(profiles.id, ctx.user.id));
    const row = await loadOwnProfile(ctx.tx, ctx.user.id);
    return toProfileDto(row!);
  }),

  /** Simulated UAE PASS status change, with transition validation. */
  setIdentityStatus: customerProcedure
    .input(z.object({ status: identityStatusSchema }))
    .mutation(async ({ ctx, input }) => {
      const current = await loadOwnProfile(ctx.tx, ctx.user.id);
      if (!current) throw new TRPCError({ code: 'NOT_FOUND' });
      const from = current.identityVerificationStatus as IdentityVerificationStatus;
      if (from !== input.status && !canTransitionIdentity(from, input.status)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Invalid identity transition ${from} -> ${input.status}`,
        });
      }
      await ctx.tx
        .update(profiles)
        .set({ identityVerificationStatus: input.status })
        .where(eq(profiles.id, ctx.user.id));
      const row = await loadOwnProfile(ctx.tx, ctx.user.id);
      return toProfileDto(row!);
    }),

  /** Proof helper: confirms account_type cannot be self-promoted server-side. */
  attemptSelfPromote: customerProcedure.mutation(async ({ ctx }) => {
    // The DB trigger prevent_account_type_escalation rejects this for non-privileged roles.
    try {
      await ctx.tx.execute(
        sql`update public.profiles set account_type = 'ADMIN' where id = ${ctx.user.id}`,
      );
      return { promoted: true };
    } catch {
      return { promoted: false };
    }
  }),
});
