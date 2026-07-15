import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { offerThreads, notifications } from '@markaz/db';
import { toSafeNotification } from '@markaz/domain';
import { router, customerProcedure } from '../../trpc';

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
      return rows.map((n) => {
        // Validate {kind, payload} through the discriminated-union schema; an
        // unexpected kind or malformed payload degrades to a safe UNKNOWN/null.
        const safe = toSafeNotification(n.kind, n.payload);
        return {
          id: n.id,
          kind: safe.kind,
          threadId: safe.threadId,
          transactionId: safe.transactionId,
          listingId: safe.listingId,
          read: n.readAt != null,
          createdAt: n.createdAt.toISOString(),
        };
      });
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
