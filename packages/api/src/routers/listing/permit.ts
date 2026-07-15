import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { listingStageIndex } from '@markaz/domain';
import { router, customerProcedure } from '../../trpc';
import { PermitService, type DemoOutcome } from '../../services/simulation';
import { demoOutcome, loadOwned, buildSnapshot } from './shared';

// --- Simulated Trakheesi (§19) --------------------------------------------
export const permitRouter = router({
  submit: customerProcedure
    .input(z.object({ listingId: z.string().uuid(), confirm: z.literal(true), demoOutcome }))
    .mutation(async ({ ctx, input }) => {
      const snap = await buildSnapshot(ctx.tx, input.listingId);
      if (snap.progress.photos.count < 1 || !snap.progress.photos.hasCover)
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Photos incomplete.' });
      if (listingStageIndex(snap.listing.state) < listingStageIndex('PHOTOS_COMPLETE'))
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Listing not ready for the permit step.',
        });
      return PermitService.submit(
        { tx: ctx.tx, userId: ctx.user.id, listingId: input.listingId },
        input.demoOutcome as DemoOutcome | undefined,
      );
    }),
  status: customerProcedure
    .input(z.object({ listingId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await loadOwned(ctx.tx, input.listingId);
      const rec = await PermitService.resolve({
        tx: ctx.tx,
        userId: ctx.user.id,
        listingId: input.listingId,
      });
      return {
        status: rec?.status ?? 'NOT_STARTED',
        permitNumber: rec?.permitNumber ?? null,
        failureReason: rec?.failureReason ?? null,
      };
    }),
  retry: customerProcedure
    .input(z.object({ listingId: z.string().uuid(), demoOutcome }))
    .mutation(async ({ ctx, input }) => {
      await loadOwned(ctx.tx, input.listingId);
      return PermitService.submit(
        { tx: ctx.tx, userId: ctx.user.id, listingId: input.listingId },
        input.demoOutcome as DemoOutcome | undefined,
      );
    }),
});
