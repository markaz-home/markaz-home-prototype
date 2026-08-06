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

/**
 * Fill the dashboard discovery row from a broad first-party result set. The
 * marketplace may return the customer's newest listings first, so limiting to
 * three before removing owned homes can incorrectly leave the row empty.
 */
export function selectDashboardRecommendations<T extends { publicId: string | null }>(
  cards: readonly T[],
  ownedIds: ReadonlySet<string>,
  limit = 3,
): Array<T & { publicId: string }> {
  if (limit <= 0) return [];
  return cards
    .filter(
      (card): card is T & { publicId: string } =>
        typeof card.publicId === 'string' && !ownedIds.has(card.publicId),
    )
    .slice(0, limit);
}
