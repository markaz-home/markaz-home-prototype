import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { listingStageIndex } from '@markaz/domain';
import { router, customerProcedure } from '../../trpc';
import { OwnershipVerificationService, type DemoOutcome } from '../../services/simulation';
import { demoOutcome, loadOwned, loadActiveDoc } from './shared';

// --- Ownership verification (§14) -----------------------------------------
export const verificationRouter = router({
  start: customerProcedure
    .input(z.object({ listingId: z.string().uuid(), demoOutcome }))
    .mutation(async ({ ctx, input }) => {
      const listing = await loadOwned(ctx.tx, input.listingId);
      if (!(await loadActiveDoc(ctx.tx, input.listingId)))
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Upload a document first.' });
      if (listingStageIndex(listing.state) < listingStageIndex('DOCUMENT_UPLOADED'))
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Listing not ready for verification.',
        });
      return OwnershipVerificationService.start(
        { tx: ctx.tx, userId: ctx.user.id, listingId: input.listingId },
        input.demoOutcome as DemoOutcome | undefined,
      );
    }),
  status: customerProcedure
    .input(z.object({ listingId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await loadOwned(ctx.tx, input.listingId);
      const rec = await OwnershipVerificationService.resolve({
        tx: ctx.tx,
        userId: ctx.user.id,
        listingId: input.listingId,
      });
      return { status: rec?.status ?? 'NOT_STARTED', failureReason: rec?.failureReason ?? null };
    }),
  retry: customerProcedure
    .input(z.object({ listingId: z.string().uuid(), demoOutcome }))
    .mutation(async ({ ctx, input }) => {
      await loadOwned(ctx.tx, input.listingId);
      return OwnershipVerificationService.start(
        { tx: ctx.tx, userId: ctx.user.id, listingId: input.listingId },
        input.demoOutcome as DemoOutcome | undefined,
      );
    }),
});
