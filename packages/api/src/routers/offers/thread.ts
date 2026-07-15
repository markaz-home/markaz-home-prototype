import { eq, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { offerThreads, offerEvents } from '@markaz/db';
import { toBuyerThread, toSellerThread, toTimeline, type EventInput } from '../../offer-projection';
import { router, customerProcedure } from '../../trpc';
import {
  threadIdInput,
  versionedThread,
  mapOfferError,
  perspectiveOf,
  loadSummary,
  currentProposal,
  toThreadInput,
  summaryToProperty,
} from './shared';

export const threadOffersRouter = router({
  // ---- Thread detail --------------------------------------------------------
  /** Perspective-aware thread detail + timeline (participant-only). */
  getThread: customerProcedure.input(threadIdInput).query(async ({ ctx, input }) => {
    await ctx.tx.execute(sql`select public.expire_due_offers()`);
    const [t] = await ctx.tx
      .select()
      .from(offerThreads)
      .where(eq(offerThreads.id, input.threadId))
      .limit(1);
    if (!t) throw new TRPCError({ code: 'NOT_FOUND', message: 'NOT_FOUND' });
    const perspective = perspectiveOf(t, ctx.user.id);
    if (perspective === 'SELLER')
      await ctx.tx.execute(sql`select public.mark_offer_viewed(${t.id}::uuid)`);

    const s = await loadSummary(ctx.tx, t.listingId);
    if (!s) throw new TRPCError({ code: 'NOT_FOUND', message: 'NOT_FOUND' });
    const cur = await currentProposal(ctx.tx, t.currentProposalId);
    const eventRows = await ctx.tx
      .select()
      .from(offerEvents)
      .where(eq(offerEvents.threadId, t.id))
      .orderBy(offerEvents.createdAt);
    const timeline = toTimeline(
      eventRows.map(
        (e): EventInput => ({
          id: e.id,
          eventType: e.eventType,
          actorSide: e.actorSide,
          amountAed: e.amountAed,
          metadata: e.metadata,
          createdAt: e.createdAt,
        }),
      ),
    );

    const thread =
      perspective === 'BUYER'
        ? toBuyerThread({ thread: toThreadInput(t), current: cur, property: summaryToProperty(s) })
        : toSellerThread({
            thread: toThreadInput(t),
            current: cur,
            property: summaryToProperty(s),
            minNotificationPrice:
              s.minNotificationPrice == null ? null : Number(s.minNotificationPrice),
          });
    return { thread, timeline };
  }),

  reject: customerProcedure
    .input(versionedThread.extend({ reasonCode: z.string().max(40).optional() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.tx.execute(
          sql`select public.reject_offer(${input.threadId}::uuid, ${input.expectedVersion}, ${input.reasonCode ?? null})`,
        );
        return { ok: true as const };
      } catch (e) {
        mapOfferError(e);
      }
    }),
});
