import { describe, expect, it } from 'vitest';
import { isFreshDashboard, selectDashboardRecommendations } from '@/lib/dashboard-state';

const empty = {
  saved: 0,
  listings: 0,
  buyerThreads: 0,
  sellerThreads: 0,
  transactions: 0,
};

describe('isFreshDashboard', () => {
  it('recognises a successfully loaded empty account', () => {
    expect(isFreshDashboard(empty, false)).toBe(true);
  });

  it('does not treat unavailable data as a fresh account', () => {
    expect(isFreshDashboard(empty, true)).toBe(false);
  });

  it('does not treat an account with activity as fresh', () => {
    expect(isFreshDashboard({ ...empty, transactions: 1 }, false)).toBe(false);
  });
});

describe('selectDashboardRecommendations', () => {
  it('fills the row from later MARKAZ listings when the newest homes are owned', () => {
    const cards = [
      { publicId: 'mine-1', headline: 'Mine one' },
      { publicId: 'mine-2', headline: 'Mine two' },
      { publicId: 'mine-3', headline: 'Mine three' },
      { publicId: 'other-1', headline: 'Other one' },
      { publicId: 'other-2', headline: 'Other two' },
      { publicId: 'other-3', headline: 'Other three' },
    ];

    expect(
      selectDashboardRecommendations(cards, new Set(['mine-1', 'mine-2', 'mine-3'])).map(
        (card) => card.publicId,
      ),
    ).toEqual(['other-1', 'other-2', 'other-3']);
  });

  it('never returns an owned or unidentified listing', () => {
    expect(
      selectDashboardRecommendations(
        [{ publicId: null }, { publicId: 'mine' }, { publicId: 'other' }],
        new Set(['mine']),
      ).map((card) => card.publicId),
    ).toEqual(['other']);
  });
});
