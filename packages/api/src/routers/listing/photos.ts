import { and, eq } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { listings, propertyPhotos } from '@markaz/db';
import { router, customerProcedure } from '../../trpc';
import { loadOwned, audit, buildSnapshot } from './shared';

// --- Photos (§18) ---------------------------------------------------------
export const photosRouter = router({
  register: customerProcedure
    .input(
      z.object({
        listingId: z.string().uuid(),
        storagePath: z.string().min(1),
        originalName: z.string().max(255).optional(),
        contentType: z.string().max(120).optional(),
        sizeBytes: z
          .number()
          .int()
          .positive()
          .max(12 * 1024 * 1024)
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await loadOwned(ctx.tx, input.listingId);
      const existing = await ctx.tx
        .select()
        .from(propertyPhotos)
        .where(eq(propertyPhotos.listingId, input.listingId));
      if (existing.length >= 20)
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'You can upload up to 20 photographs.',
        });
      const isFirst = existing.length === 0;
      const maxOrder = existing.reduce((m, p) => Math.max(m, p.sortOrder), -1);
      const [row] = await ctx.tx
        .insert(propertyPhotos)
        .values({
          listingId: input.listingId,
          storagePath: input.storagePath,
          originalName: input.originalName ?? null,
          contentType: input.contentType ?? null,
          sizeBytes: input.sizeBytes ?? null,
          isCover: isFirst,
          sortOrder: maxOrder + 1,
        })
        .returning({ id: propertyPhotos.id });
      await audit(ctx.tx, ctx.user.id, 'LISTING_PHOTOS_UPDATED', input.listingId);
      return { photoId: row!.id, isCover: isFirst };
    }),
  reorder: customerProcedure
    .input(
      z.object({ listingId: z.string().uuid(), orderedIds: z.array(z.string().uuid()).min(1) }),
    )
    .mutation(async ({ ctx, input }) => {
      await loadOwned(ctx.tx, input.listingId);
      for (let i = 0; i < input.orderedIds.length; i++) {
        await ctx.tx
          .update(propertyPhotos)
          .set({ sortOrder: i })
          .where(
            and(
              eq(propertyPhotos.id, input.orderedIds[i]!),
              eq(propertyPhotos.listingId, input.listingId),
            ),
          );
      }
      await audit(ctx.tx, ctx.user.id, 'LISTING_PHOTOS_UPDATED', input.listingId);
      return { ok: true as const };
    }),
  setCover: customerProcedure
    .input(z.object({ listingId: z.string().uuid(), photoId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await loadOwned(ctx.tx, input.listingId);
      await ctx.tx
        .update(propertyPhotos)
        .set({ isCover: false })
        .where(eq(propertyPhotos.listingId, input.listingId));
      await ctx.tx
        .update(propertyPhotos)
        .set({ isCover: true })
        .where(
          and(eq(propertyPhotos.id, input.photoId), eq(propertyPhotos.listingId, input.listingId)),
        );
      await audit(ctx.tx, ctx.user.id, 'LISTING_COVER_PHOTO_CHANGED', input.listingId);
      return { ok: true as const };
    }),
  delete: customerProcedure
    .input(z.object({ listingId: z.string().uuid(), photoId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await loadOwned(ctx.tx, input.listingId);
      const [target] = await ctx.tx
        .select()
        .from(propertyPhotos)
        .where(
          and(eq(propertyPhotos.id, input.photoId), eq(propertyPhotos.listingId, input.listingId)),
        )
        .limit(1);
      if (!target) throw new TRPCError({ code: 'NOT_FOUND' });
      await ctx.tx.delete(propertyPhotos).where(eq(propertyPhotos.id, input.photoId));
      // If the cover was removed, promote the new first photo.
      if (target.isCover) {
        const [next] = await ctx.tx
          .select()
          .from(propertyPhotos)
          .where(eq(propertyPhotos.listingId, input.listingId))
          .orderBy(propertyPhotos.sortOrder)
          .limit(1);
        if (next)
          await ctx.tx
            .update(propertyPhotos)
            .set({ isCover: true })
            .where(eq(propertyPhotos.id, next.id));
      }
      await audit(ctx.tx, ctx.user.id, 'LISTING_PHOTOS_UPDATED', input.listingId);
      return { removedPhotos: [target.storagePath] };
    }),
  /** Advance to PHOTOS_COMPLETE once ≥1 photo + a cover exist and Form A is complete. */
  complete: customerProcedure
    .input(z.object({ listingId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const snap = await buildSnapshot(ctx.tx, input.listingId);
      if (snap.progress.formA.status !== 'COMPLETE')
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Complete Form A first.' });
      if (snap.photos.length < 1 || !snap.photos.some((p) => p.isCover))
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Add at least one photo and a cover.',
        });
      if (snap.listing.state === 'FORM_A_COMPLETE') {
        await ctx.tx
          .update(listings)
          .set({ state: 'PHOTOS_COMPLETE', currentStep: 'trakheesi' })
          .where(eq(listings.id, input.listingId));
      }
      return { ok: true as const };
    }),
});
