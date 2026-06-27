import { sql, count, eq, inArray, and, ne } from 'drizzle-orm';
import { listings, offers, transactions } from '@markaz/db';
import { router, adminProcedure } from '../trpc';

const REVIEW_STATES = ['OWNERSHIP_REVIEW', 'PERMIT_PENDING'] as const;
const PENDING_OFFER_STATES = ['SUBMITTED', 'UNDER_REVIEW', 'COUNTERED'] as const;

export const adminOverviewRouter = router({
  /** Foundational operational metrics for the Admin Overview (ADMIN only). */
  metrics: adminProcedure.query(async ({ ctx }) => {
    const tx = ctx.tx;
    const [
      activeListings,
      awaitingReview,
      pendingOffers,
      activeTransactions,
      flaggedTransactions,
      completedDemo,
    ] = await Promise.all([
      tx.select({ n: count() }).from(listings).where(eq(listings.state, 'LIVE')),
      tx.select({ n: count() }).from(listings).where(inArray(listings.state, [...REVIEW_STATES])),
      tx.select({ n: count() }).from(offers).where(inArray(offers.state, [...PENDING_OFFER_STATES])),
      tx.select({ n: count() }).from(transactions).where(ne(transactions.stage, 'COMPLETE_DEMO')),
      tx
        .select({ n: count() })
        .from(transactions)
        .where(and(eq(transactions.flagged, true), ne(transactions.stage, 'COMPLETE_DEMO'))),
      tx.select({ n: count() }).from(transactions).where(eq(transactions.stage, 'COMPLETE_DEMO')),
    ]);

    return {
      activeListings: Number(activeListings[0]?.n ?? 0),
      listingsAwaitingReview: Number(awaitingReview[0]?.n ?? 0),
      pendingOffers: Number(pendingOffers[0]?.n ?? 0),
      activeTransactions: Number(activeTransactions[0]?.n ?? 0),
      flaggedTransactions: Number(flaggedTransactions[0]?.n ?? 0),
      completedDemoTransactions: Number(completedDemo[0]?.n ?? 0),
    };
  }),

  /** Confirms admin scope via the DB context. */
  contextProbe: adminProcedure.query(async ({ ctx }) => {
    const r = await ctx.tx.execute(sql`select public.is_admin() as is_admin`);
    const row = (r as unknown as Array<{ is_admin: boolean }>)[0];
    return { isAdmin: row?.is_admin ?? false, accountType: ctx.user.accountType };
  }),
});
