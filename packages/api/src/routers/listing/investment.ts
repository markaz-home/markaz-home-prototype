import { eq } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { listings, properties, investmentCases } from '@markaz/db';
import { investmentCaseSchema, calculateInvestmentCase } from '@markaz/domain';
import { router, customerProcedure } from '../../trpc';
import { num, loadOwned, audit } from './shared';

// --- Investment Case (§16) ------------------------------------------------
export const investmentRouter = router({
  save: customerProcedure
    .input(investmentCaseSchema.and(z.object({ listingId: z.string().uuid() })))
    .mutation(async ({ ctx, input }) => {
      const listing = await loadOwned(ctx.tx, input.listingId);
      const asking = num(listing.askingPrice);
      if (!asking)
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Add an asking price first.' });
      const [property] = listing.propertyId
        ? await ctx.tx
            .select()
            .from(properties)
            .where(eq(properties.id, listing.propertyId))
            .limit(1)
        : [null];
      const calc = calculateInvestmentCase({
        askingPriceAed: asking,
        originalPurchasePriceAed: input.originalPurchasePriceAed,
        renovationCostsAed: input.renovationCostsAed,
        purchaseDate: input.purchaseDate,
        sizeSqft: property?.sizeSqft ? Number(property.sizeSqft) : null,
        asOf: new Date().toISOString().slice(0, 10),
      });
      const values = {
        listingId: input.listingId,
        originalPurchasePrice: String(input.originalPurchasePriceAed),
        purchaseDate: input.purchaseDate,
        renovationCosts: String(input.renovationCostsAed),
        totalInvested: String(calc.totalInvestedAed),
        estimatedGain: String(calc.estimatedGainAed),
        estimatedRoiPct: calc.estimatedRoiPct === null ? null : String(calc.estimatedRoiPct),
        estimatedAnnualisedReturnPct:
          calc.estimatedAnnualisedReturnPct === null
            ? null
            : String(calc.estimatedAnnualisedReturnPct),
        pricePerSqft: calc.pricePerSqftAed === null ? null : String(calc.pricePerSqftAed),
        visible: input.visible,
      };
      await ctx.tx
        .insert(investmentCases)
        .values(values)
        .onConflictDoUpdate({ target: investmentCases.listingId, set: values });
      await ctx.tx
        .update(listings)
        .set({
          investmentCaseVisible: input.visible,
          investmentCaseSkipped: false,
          currentStep: 'form-a',
        })
        .where(eq(listings.id, input.listingId));
      await audit(ctx.tx, ctx.user.id, 'INVESTMENT_CASE_SAVED', input.listingId, {
        visible: input.visible,
      });
      return { ok: true as const };
    }),
  skip: customerProcedure
    .input(z.object({ listingId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await loadOwned(ctx.tx, input.listingId);
      await ctx.tx
        .update(listings)
        .set({ investmentCaseSkipped: true, currentStep: 'form-a' })
        .where(eq(listings.id, input.listingId));
      await audit(ctx.tx, ctx.user.id, 'INVESTMENT_CASE_SKIPPED', input.listingId);
      return { ok: true as const };
    }),
  setVisibility: customerProcedure
    .input(z.object({ listingId: z.string().uuid(), visible: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await loadOwned(ctx.tx, input.listingId);
      await ctx.tx
        .update(investmentCases)
        .set({ visible: input.visible })
        .where(eq(investmentCases.listingId, input.listingId));
      await ctx.tx
        .update(listings)
        .set({ investmentCaseVisible: input.visible })
        .where(eq(listings.id, input.listingId));
      await audit(ctx.tx, ctx.user.id, 'INVESTMENT_CASE_SAVED', input.listingId, {
        visible: input.visible,
      });
      return { ok: true as const };
    }),
  remove: customerProcedure
    .input(z.object({ listingId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await loadOwned(ctx.tx, input.listingId);
      await ctx.tx.delete(investmentCases).where(eq(investmentCases.listingId, input.listingId));
      await ctx.tx
        .update(listings)
        .set({ investmentCaseVisible: false, investmentCaseSkipped: true })
        .where(eq(listings.id, input.listingId));
      await audit(ctx.tx, ctx.user.id, 'INVESTMENT_CASE_SKIPPED', input.listingId);
      return { ok: true as const };
    }),
});
