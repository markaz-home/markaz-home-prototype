import { describe, expect, it } from 'vitest';
import { isFreshDashboard } from '@/lib/dashboard-state';

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
