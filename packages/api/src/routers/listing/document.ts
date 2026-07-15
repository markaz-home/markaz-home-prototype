import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { listings, ownershipDocuments, verifications } from '@markaz/db';
import { listingStageIndex } from '@markaz/domain';
import { router, customerProcedure } from '../../trpc';
import { loadOwned, audit, invalidateDownstream } from './shared';

// --- Ownership document ---------------------------------------------------
export const documentRouter = router({
  register: customerProcedure
    .input(
      z.object({
        listingId: z.string().uuid(),
        documentType: z.enum(['TITLE_DEED', 'OQOOD']),
        storagePath: z.string().min(1),
        originalName: z.string().max(255).optional(),
        contentType: z.string().max(120).optional(),
        sizeBytes: z
          .number()
          .int()
          .positive()
          .max(10 * 1024 * 1024)
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const listing = await loadOwned(ctx.tx, input.listingId);
      const replacing = listingStageIndex(listing.state) >= listingStageIndex('DOCUMENT_UPLOADED');
      await ctx.tx
        .update(ownershipDocuments)
        .set({ active: false })
        .where(
          and(
            eq(ownershipDocuments.listingId, input.listingId),
            eq(ownershipDocuments.active, true),
          ),
        );
      await ctx.tx.insert(ownershipDocuments).values({
        listingId: input.listingId,
        ownerId: ctx.user.id,
        documentType: input.documentType,
        storagePath: input.storagePath,
        originalName: input.originalName ?? null,
        contentType: input.contentType ?? null,
        sizeBytes: input.sizeBytes ?? null,
        active: true,
        status: 'PENDING',
      });
      // Replacing a document resets verification + everything downstream.
      await ctx.tx
        .update(verifications)
        .set({ supersededAt: new Date() })
        .where(
          and(eq(verifications.listingId, input.listingId), isNull(verifications.supersededAt)),
        );
      if (listing.state === 'DETAILS_COMPLETE') {
        await ctx.tx
          .update(listings)
          .set({ state: 'DOCUMENT_UPLOADED', currentStep: 'verification' })
          .where(eq(listings.id, input.listingId));
      } else if (listingStageIndex(listing.state) > listingStageIndex('DOCUMENT_UPLOADED')) {
        await invalidateDownstream(ctx.tx, input.listingId, listing.state, 'DOCUMENT_UPLOADED');
      }
      await audit(
        ctx.tx,
        ctx.user.id,
        replacing ? 'OWNERSHIP_DOCUMENT_REPLACED' : 'OWNERSHIP_DOCUMENT_UPLOADED',
        input.listingId,
        { documentType: input.documentType },
      );
      return { ok: true as const };
    }),

  remove: customerProcedure
    .input(z.object({ listingId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const listing = await loadOwned(ctx.tx, input.listingId);
      const removed = (
        await ctx.tx
          .select()
          .from(ownershipDocuments)
          .where(
            and(
              eq(ownershipDocuments.listingId, input.listingId),
              eq(ownershipDocuments.active, true),
            ),
          )
      ).map((d) => d.storagePath);
      await ctx.tx
        .update(ownershipDocuments)
        .set({ active: false })
        .where(eq(ownershipDocuments.listingId, input.listingId));
      await ctx.tx
        .update(verifications)
        .set({ supersededAt: new Date() })
        .where(
          and(eq(verifications.listingId, input.listingId), isNull(verifications.supersededAt)),
        );
      if (listingStageIndex(listing.state) > listingStageIndex('DETAILS_COMPLETE')) {
        await invalidateDownstream(ctx.tx, input.listingId, listing.state, 'DETAILS_COMPLETE');
        await ctx.tx
          .update(listings)
          .set({ state: 'DETAILS_COMPLETE' })
          .where(eq(listings.id, input.listingId));
      }
      await audit(ctx.tx, ctx.user.id, 'OWNERSHIP_DOCUMENT_REMOVED', input.listingId);
      return { removedDocuments: removed };
    }),
});
