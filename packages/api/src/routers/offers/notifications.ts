import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { offerThreads, offerProposals, transactions, notifications } from '@markaz/db';
import { toSafeNotification } from '@markaz/domain';
import { offerPropertySummary } from '../../offer-projection';
import { router, customerProcedure } from '../../trpc';
import { loadSummary, summaryToProperty } from './shared';

export const notificationsOffersRouter = router({
  // ---- Notifications + badges -----------------------------------------------
  /** Action-needed badge (Offers nav) + bell unread count. */
  getUnreadCounts: customerProcedure.query(async ({ ctx }) => {
    await ctx.tx.execute(sql`select public.expire_due_offers()`);
    const [bell] = await ctx.tx
      .select({ n: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.recipientId, ctx.user.id), isNull(notifications.readAt)));
    const action = await ctx.tx
      .select({
        status: offerThreads.status,
        nextActor: offerThreads.nextActor,
        buyer: offerThreads.buyerUserId,
        seller: offerThreads.sellerUserId,
      })
      .from(offerThreads)
      .where(inArray(offerThreads.status, ['AWAITING_SELLER', 'AWAITING_BUYER']));
    const actionNeeded = action.filter(
      (t) =>
        (t.buyer === ctx.user.id && t.status === 'AWAITING_BUYER' && t.nextActor === 'BUYER') ||
        (t.seller === ctx.user.id && t.status === 'AWAITING_SELLER' && t.nextActor === 'SELLER'),
    ).length;
    return { unread: Number(bell?.n ?? 0), actionNeeded };
  }),

  /** Recent in-app notifications for the header bell menu (§30.3). */
  notifications: customerProcedure
    .input(z.object({ limit: z.number().int().min(1).max(50).default(20) }).optional())
    .query(async ({ ctx, input }) => {
      const rows = await ctx.tx
        .select()
        .from(notifications)
        .where(eq(notifications.recipientId, ctx.user.id))
        .orderBy(desc(notifications.createdAt))
        .limit(input?.limit ?? 20);
      const projected = rows.map((n) => {
        // Validate {kind, payload} through the discriminated-union schema; an
        // unexpected kind or malformed payload degrades to a safe UNKNOWN/null.
        const safe = toSafeNotification(n.kind, n.payload);
        return {
          id: n.id,
          kind: safe.kind,
          threadId: safe.threadId,
          transactionId: safe.transactionId,
          listingId: safe.listingId,
          amountAed: safe.amountAed,
          read: n.readAt != null,
          createdAt: n.createdAt.toISOString(),
        };
      });

      // Backfill context for notifications created before contextual payloads were
      // introduced, then load each unique public-safe property summary once.
      const threadIds = [...new Set(projected.flatMap((n) => (n.threadId ? [n.threadId] : [])))];
      const transactionIds = [
        ...new Set(projected.flatMap((n) => (n.transactionId ? [n.transactionId] : []))),
      ];
      const threadContext = new Map<string, { listingId: string; amountAed: number | null }>();
      if (threadIds.length > 0) {
        const threadRows = await ctx.tx
          .select({
            id: offerThreads.id,
            listingId: offerThreads.listingId,
            amountAed: offerProposals.amountAed,
          })
          .from(offerThreads)
          .leftJoin(offerProposals, eq(offerProposals.id, offerThreads.currentProposalId))
          .where(inArray(offerThreads.id, threadIds));
        for (const row of threadRows) {
          threadContext.set(row.id, {
            listingId: row.listingId,
            amountAed: row.amountAed == null ? null : Number(row.amountAed),
          });
        }
      }
      const transactionContext = new Map<
        string,
        { listingId: string; amountAed: number | null }
      >();
      if (transactionIds.length > 0) {
        const transactionRows = await ctx.tx
          .select({
            id: transactions.id,
            listingId: transactions.listingId,
            amountAed: transactions.acceptedAmountAed,
          })
          .from(transactions)
          .where(inArray(transactions.id, transactionIds));
        for (const row of transactionRows) {
          transactionContext.set(row.id, {
            listingId: row.listingId,
            amountAed: Number(row.amountAed),
          });
        }
      }

      const resolved = projected.map((n) => {
        const fallback = n.threadId
          ? threadContext.get(n.threadId)
          : n.transactionId
            ? transactionContext.get(n.transactionId)
            : undefined;
        return {
          ...n,
          listingId: n.listingId ?? fallback?.listingId ?? null,
          amountAed: n.amountAed ?? fallback?.amountAed ?? null,
        };
      });
      const listingIds = [
        ...new Set(resolved.flatMap((n) => (n.listingId ? [n.listingId] : []))),
      ];
      const propertyByListing = new Map<
        string,
        ReturnType<typeof offerPropertySummary> | null
      >();
      for (const listingId of listingIds) {
        const summary = await loadSummary(ctx.tx, listingId);
        propertyByListing.set(
          listingId,
          summary ? offerPropertySummary(summaryToProperty(summary)) : null,
        );
      }
      return resolved.map((n) => ({
        ...n,
        property: n.listingId ? (propertyByListing.get(n.listingId) ?? null) : null,
      }));
    }),

  markNotificationRead: customerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.tx
        .update(notifications)
        .set({ readAt: new Date() })
        .where(and(eq(notifications.id, input.id), eq(notifications.recipientId, ctx.user.id)));
      return { ok: true as const };
    }),

  markAllNotificationsRead: customerProcedure.mutation(async ({ ctx }) => {
    await ctx.tx
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.recipientId, ctx.user.id), isNull(notifications.readAt)));
    return { ok: true as const };
  }),
});
