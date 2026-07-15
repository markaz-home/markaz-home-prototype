import { eq } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { listings } from '@markaz/db';
import { publicationChecklist, isPublicationEligible } from '@markaz/domain';
import { router, customerProcedure } from '../../trpc';
import { PublicationReviewService } from '../../services/publication';
import { type DemoOutcome } from '../../services/simulation';
import { num, loadOwned, buildSnapshot } from './shared';

// --- Publication (§12–§16) ------------------------------------------------
export const publicationRouter = router({
  /** Publication checklist + eligibility for a READY_TO_PUBLISH listing. */
  checklist: customerProcedure
    .input(z.object({ listingId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const snap = await buildSnapshot(ctx.tx, input.listingId);
      const asking = num(snap.listing.askingPrice);
      return {
        items: publicationChecklist(snap.progress, asking),
        eligible: isPublicationEligible(snap.progress, asking),
        listingState: snap.listing.state,
      };
    }),
  /** Submit for simulated publication review (server re-validates eligibility). */
  submit: customerProcedure
    .input(
      z.object({
        listingId: z.string().uuid(),
        confirm: z.literal(true),
        demoOutcome: z.enum(['SUCCESS', 'FAILURE']).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const snap = await buildSnapshot(ctx.tx, input.listingId);
      if (snap.listing.state !== 'READY_TO_PUBLISH')
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Listing is not ready to publish.' });
      if (!isPublicationEligible(snap.progress, num(snap.listing.askingPrice)))
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Publication checklist is incomplete.',
        });
      const req = await PublicationReviewService.submit(
        { tx: ctx.tx, userId: ctx.user.id, listingId: input.listingId },
        input.demoOutcome as DemoOutcome | undefined,
      );
      return { status: req.status };
    }),
  /** Resolve the pending request (prepare public photos → atomic LIVE, or return). */
  status: customerProcedure
    .input(z.object({ listingId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await loadOwned(ctx.tx, input.listingId);
      const req = await PublicationReviewService.resolve({
        tx: ctx.tx,
        userId: ctx.user.id,
        listingId: input.listingId,
      });
      const [l] = await ctx.tx
        .select({ state: listings.state, publicId: listings.publicId, slug: listings.publicSlug })
        .from(listings)
        .where(eq(listings.id, input.listingId))
        .limit(1);
      return {
        status: req?.status ?? 'NOT_SUBMITTED',
        outcomeCategory: req?.outcomeCategory ?? null,
        listingState: l?.state ?? null,
        publicId: l?.publicId ?? null,
        slug: l?.slug ?? null,
      };
    }),
  /** Resubmit after a returned review. */
  retry: customerProcedure
    .input(
      z.object({
        listingId: z.string().uuid(),
        demoOutcome: z.enum(['SUCCESS', 'FAILURE']).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const snap = await buildSnapshot(ctx.tx, input.listingId);
      if (!isPublicationEligible(snap.progress, num(snap.listing.askingPrice)))
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Publication checklist is incomplete.',
        });
      const req = await PublicationReviewService.submit(
        { tx: ctx.tx, userId: ctx.user.id, listingId: input.listingId },
        input.demoOutcome as DemoOutcome | undefined,
      );
      return { status: req.status };
    }),
});
