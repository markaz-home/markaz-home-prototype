import { eq } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { listings } from '@markaz/db';
import { computeReadiness } from '@markaz/domain';
import { router, customerProcedure } from '../../trpc';
import { audit, buildSnapshot } from './shared';

// --- Review + READY_TO_PUBLISH (§20–21) -----------------------------------
export const reviewRouter = router({
  status: customerProcedure
    .input(z.object({ listingId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const snap = await buildSnapshot(ctx.tx, input.listingId);
      const readiness = computeReadiness(snap.progress);
      return {
        sections: readiness.statuses,
        ready: readiness.ready,
        blocking: readiness.blocking,
      };
    }),
  markReady: customerProcedure
    .input(z.object({ listingId: z.string().uuid(), confirm: z.literal(true) }))
    .mutation(async ({ ctx, input }) => {
      const snap = await buildSnapshot(ctx.tx, input.listingId);
      const readiness = computeReadiness(snap.progress); // server-authoritative re-check
      if (!readiness.ready)
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Listing is not ready.' });
      if (snap.listing.state !== 'PERMIT_PENDING')
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Unexpected listing state.' });
      await ctx.tx
        .update(listings)
        .set({ state: 'READY_TO_PUBLISH', currentStep: 'ready', reviewConfirmedAt: new Date() })
        .where(eq(listings.id, input.listingId));
      await audit(ctx.tx, ctx.user.id, 'LISTING_READY_TO_PUBLISH', input.listingId);
      return { ok: true as const, state: 'READY_TO_PUBLISH' as const };
    }),
});
