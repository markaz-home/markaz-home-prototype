import { desc, eq, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { offerThreads } from '@markaz/db';
import { expiryOptionSchema, resolveAvailability, type OfferThreadStatus } from '@markaz/domain';
import { toSellerThread, offerPropertySummary } from '../../offer-projection';
import { router, customerProcedure } from '../../trpc';
import {
  amountInput,
  versionedThread,
  loadSummary,
  currentProposal,
  toThreadInput,
  summaryToProperty,
  matchesSellerFilter,
  runCounter,
  runAccept,
  type ListingSummaryRow,
} from './shared';

export const sellerOffersRouter = router({
  /** Threads received across the current customer's listings (seller perspective). */
  getSellerInbox: customerProcedure
    .input(
      z
        .object({
          filter: z
            .enum([
              'all',
              'action',
              'waiting',
              'accepted',
              'closed',
              'aboveThreshold',
              'belowThreshold',
            ])
            .default('all'),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      await ctx.tx.execute(sql`select public.expire_due_offers()`);
      const rows = await ctx.tx
        .select()
        .from(offerThreads)
        .where(eq(offerThreads.sellerUserId, ctx.user.id))
        .orderBy(desc(offerThreads.lastActivityAt));
      const summaries = new Map<string, ListingSummaryRow | null>();
      const out = [];
      for (const t of rows) {
        if (
          !matchesSellerFilter(t.status as OfferThreadStatus, t.nextActor, input?.filter ?? 'all')
        )
          continue;
        if (!summaries.has(t.listingId))
          summaries.set(t.listingId, await loadSummary(ctx.tx, t.listingId));
        const s = summaries.get(t.listingId);
        if (!s) continue;
        const cur = await currentProposal(ctx.tx, t.currentProposalId);
        const view = toSellerThread({
          thread: toThreadInput(t),
          current: cur,
          property: summaryToProperty(s),
          minNotificationPrice:
            s.minNotificationPrice == null ? null : Number(s.minNotificationPrice),
        });
        // Threshold-based seller filters.
        if (input?.filter === 'aboveThreshold' && view.threshold !== 'AT_OR_ABOVE') continue;
        if (input?.filter === 'belowThreshold' && view.threshold !== 'BELOW') continue;
        out.push(view);
      }
      return out;
    }),

  /** Listing-specific seller offer management view (owner-only). */
  getListingOffers: customerProcedure
    .input(z.object({ listingId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const s = await loadSummary(ctx.tx, input.listingId);
      if (!s || s.ownerId !== ctx.user.id)
        throw new TRPCError({ code: 'NOT_FOUND', message: 'NOT_FOUND' });
      await ctx.tx.execute(sql`select public.expire_due_offers()`);
      const rows = await ctx.tx
        .select()
        .from(offerThreads)
        .where(eq(offerThreads.listingId, input.listingId))
        .orderBy(desc(offerThreads.lastActivityAt));
      const min = s.minNotificationPrice == null ? null : Number(s.minNotificationPrice);
      const threads = [];
      let highest: number | null = null;
      let actionNeeded = 0;
      let activeCount = 0;
      for (const t of rows) {
        const cur = await currentProposal(ctx.tx, t.currentProposalId);
        const view = toSellerThread({
          thread: toThreadInput(t),
          current: cur,
          property: summaryToProperty(s),
          minNotificationPrice: min,
        });
        if (view.isActionable) actionNeeded += 1;
        if (t.status === 'AWAITING_SELLER' || t.status === 'AWAITING_BUYER') {
          activeCount += 1;
          if (cur) highest = Math.max(highest ?? 0, Number(cur.amountAed));
        }
        threads.push(view);
      }
      const availability = resolveAvailability({
        listingState: s.state,
        hasAcceptedOffer: rows.some((r) => r.status === 'ACCEPTED'),
      });
      return {
        listing: {
          ...offerPropertySummary(summaryToProperty(s)),
          state: s.state,
          availability,
          // Threshold is shown ONLY on the owner's own listing view (§18.1).
          notificationThresholdAed: min,
          activeCount,
          actionNeeded,
          highestProposalAed: highest,
        },
        threads,
      };
    }),

  // ---- Mutations (server-authoritative via SQL functions) -------------------
  submitSellerCounter: customerProcedure
    .input(versionedThread.extend({ amountAed: amountInput, expiry: expiryOptionSchema }))
    .mutation(({ ctx, input }) => runCounter(ctx, input)),

  acceptBuyerProposal: customerProcedure
    .input(versionedThread.extend({ proposalId: z.string().uuid() }))
    .mutation(({ ctx, input }) => runAccept(ctx, input)),
});
