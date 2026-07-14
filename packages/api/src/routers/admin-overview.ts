import { sql, count, eq, inArray, notInArray } from 'drizzle-orm';
import { listings, offerThreads, transactions } from '@markaz/db';
import { router, adminProcedure } from '../trpc';

// Week-5 canonical transactions: "active" = not terminal; "flagged" = needs review (FAILED).
const TERMINAL_TX_STATES = ['COMPLETED_DEMO', 'CANCELLED', 'FAILED'] as const;

const REVIEW_STATES = ['OWNERSHIP_REVIEW', 'PERMIT_PENDING'] as const;
// Week 4: "pending offers" = active negotiations awaiting a party's action.
const ACTIVE_THREAD_STATES = ['AWAITING_SELLER', 'AWAITING_BUYER'] as const;

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
      tx
        .select({ n: count() })
        .from(listings)
        .where(inArray(listings.state, [...REVIEW_STATES])),
      tx
        .select({ n: count() })
        .from(offerThreads)
        .where(inArray(offerThreads.status, [...ACTIVE_THREAD_STATES])),
      tx
        .select({ n: count() })
        .from(transactions)
        .where(notInArray(transactions.status, [...TERMINAL_TX_STATES])),
      tx.select({ n: count() }).from(transactions).where(eq(transactions.status, 'FAILED')),
      tx.select({ n: count() }).from(transactions).where(eq(transactions.status, 'COMPLETED_DEMO')),
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
