export interface DashboardActivityCounts {
  saved: number;
  listings: number;
  buyerThreads: number;
  sellerThreads: number;
  transactions: number;
}

/**
 * The welcome card is evidence of a genuinely empty account, not a fallback for
 * unavailable data. Any failed dashboard read makes freshness unknown.
 */
export function isFreshDashboard(counts: DashboardActivityCounts, loadFailed: boolean): boolean {
  return (
    !loadFailed &&
    counts.saved === 0 &&
    counts.listings === 0 &&
    counts.buyerThreads === 0 &&
    counts.sellerThreads === 0 &&
    counts.transactions === 0
  );
}
