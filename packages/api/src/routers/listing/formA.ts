import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { router, customerProcedure } from '../../trpc';
import { FormAService, type DemoOutcome } from '../../services/simulation';
import { demoOutcome, num, buildSnapshot } from './shared';

// --- Simulated Form A (§17) -----------------------------------------------
export const formARouter = router({
  complete: customerProcedure
    .input(z.object({ listingId: z.string().uuid(), confirm: z.literal(true), demoOutcome }))
    .mutation(async ({ ctx, input }) => {
      const snap = await buildSnapshot(ctx.tx, input.listingId);
      if (snap.progress.verification.status !== 'VERIFIED')
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Ownership not verified.' });
      if (!snap.progress.settingsComplete)
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Listing settings incomplete.' });
      return FormAService.complete(
        { tx: ctx.tx, userId: ctx.user.id, listingId: input.listingId },
        num(snap.listing.askingPrice) ?? 0,
        input.demoOutcome as DemoOutcome | undefined,
      );
    }),
});
