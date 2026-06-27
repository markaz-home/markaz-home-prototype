import { z } from 'zod';
import { auditEvents } from '@markaz/db';
import { router, protectedProcedure } from '../trpc';

/**
 * Client-emitted audit events for auth/onboarding milestones. Allow-listed
 * actions only. Metadata is generic — NEVER passwords, codes, or tokens.
 */
const CLIENT_AUDIT_ACTIONS = [
  'EMAIL_VERIFIED',
  'PASSWORD_RESET_COMPLETED',
  'CUSTOMER_SIGNED_OUT',
  'ADMIN_ACCESS_DENIED',
] as const;

export const auditRouter = router({
  record: protectedProcedure
    .input(
      z.object({
        action: z.enum(CLIENT_AUDIT_ACTIONS),
        metadata: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.tx.insert(auditEvents).values({
        actorId: ctx.user.id,
        action: input.action,
        entityType: 'auth',
        metadata: (input.metadata ?? {}) as Record<string, unknown>,
      });
      ctx.log.info({ action: input.action, userId: ctx.user.id }, 'audit.record');
      return { ok: true as const };
    }),
});
