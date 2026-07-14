import { describe, it, expect } from 'vitest';
import {
  resolveAvailability,
  isThreadActionable,
  isThreadClosed,
  actorSide,
  afterCounter,
  canAct,
  canWithdraw,
  canSubmitOffer,
  isEqualCounter,
  classifyThreshold,
  isBelowThreshold,
  offerComparison,
  offerWarning,
  expiryFromOption,
  isProposalExpired,
  normalizeAmountInput,
  validateOfferAmount,
  userFacingStatusKey,
  buyerSeqLabel,
  MAX_OFFER_AED,
  DEFAULT_EXPIRY_OPTION,
} from '../offer';

describe('offer availability (§6.1)', () => {
  it('LIVE without accepted offer is AVAILABLE', () => {
    expect(resolveAvailability({ listingState: 'LIVE', hasAcceptedOffer: false })).toBe(
      'AVAILABLE',
    );
  });
  it('LIVE with accepted offer is UNDER_OFFER', () => {
    expect(resolveAvailability({ listingState: 'LIVE', hasAcceptedOffer: true })).toBe(
      'UNDER_OFFER',
    );
  });
  it('non-LIVE is OFFERS_DISABLED', () => {
    expect(resolveAvailability({ listingState: 'PAUSED', hasAcceptedOffer: false })).toBe(
      'OFFERS_DISABLED',
    );
    expect(resolveAvailability({ listingState: 'DRAFT', hasAcceptedOffer: false })).toBe(
      'OFFERS_DISABLED',
    );
  });
});

describe('thread + next-actor logic (§5)', () => {
  it('only awaiting states are actionable', () => {
    expect(isThreadActionable('AWAITING_SELLER')).toBe(true);
    expect(isThreadActionable('AWAITING_BUYER')).toBe(true);
    expect(isThreadActionable('ACCEPTED')).toBe(false);
    expect(isThreadActionable('DRAFT')).toBe(false);
  });
  it('terminal states are closed', () => {
    for (const s of [
      'ACCEPTED',
      'REJECTED',
      'WITHDRAWN',
      'EXPIRED',
      'CLOSED_OTHER_ACCEPTED',
      'CLOSED_LISTING_UNAVAILABLE',
    ] as const) {
      expect(isThreadClosed(s)).toBe(true);
    }
    expect(isThreadClosed('AWAITING_SELLER')).toBe(false);
  });
  it('maps next_actor to a side', () => {
    expect(actorSide('BUYER')).toBe('BUYER');
    expect(actorSide('SELLER')).toBe('SELLER');
    expect(actorSide('NONE')).toBeNull();
  });
  it('flips turn after a counter', () => {
    expect(afterCounter('BUYER')).toEqual({ status: 'AWAITING_SELLER', nextActor: 'SELLER' });
    expect(afterCounter('SELLER')).toEqual({ status: 'AWAITING_BUYER', nextActor: 'BUYER' });
  });
  it('canAct requires actionable + own turn', () => {
    expect(canAct('AWAITING_SELLER', 'SELLER', 'SELLER')).toBe(true);
    expect(canAct('AWAITING_SELLER', 'SELLER', 'BUYER')).toBe(false);
    expect(canAct('ACCEPTED', 'NONE', 'SELLER')).toBe(false);
  });
  it('only buyer can withdraw an active thread', () => {
    expect(canWithdraw('AWAITING_SELLER', 'BUYER')).toBe(true);
    expect(canWithdraw('AWAITING_BUYER', 'BUYER')).toBe(true);
    expect(canWithdraw('AWAITING_SELLER', 'SELLER')).toBe(false);
    expect(canWithdraw('ACCEPTED', 'BUYER')).toBe(false);
  });
});

describe('product rules', () => {
  it('cannot offer on your own listing (§3)', () => {
    expect(canSubmitOffer({ offeringUserId: 'a', listingOwnerId: 'b' })).toBe(true);
    expect(canSubmitOffer({ offeringUserId: 'a', listingOwnerId: 'a' })).toBe(false);
  });
  it('equal counter is blocked (§21.4)', () => {
    expect(isEqualCounter(2_000_000, 2_000_000)).toBe(true);
    expect(isEqualCounter(2_100_000, 2_000_000)).toBe(false);
  });
});

describe('threshold (seller-private, §27)', () => {
  it('classifies at/above vs below', () => {
    expect(classifyThreshold(1_200_000, 1_000_000)).toBe('AT_OR_ABOVE');
    expect(classifyThreshold(1_000_000, 1_000_000)).toBe('AT_OR_ABOVE');
    expect(classifyThreshold(900_000, 1_000_000)).toBe('BELOW');
    expect(classifyThreshold(900_000, null)).toBe('AT_OR_ABOVE');
  });
  it('isBelowThreshold matches', () => {
    expect(isBelowThreshold(900_000, 1_000_000)).toBe(true);
    expect(isBelowThreshold(1_200_000, 1_000_000)).toBe(false);
    expect(isBelowThreshold(900_000, null)).toBe(false);
  });
});

describe('comparison + warnings (§13.5–13.6)', () => {
  it('computes absolute + percentage difference', () => {
    expect(offerComparison(2_250_000, 2_400_000)).toEqual({
      absDiff: 150_000,
      pct: 6.3,
      direction: 'BELOW',
    });
    expect(offerComparison(2_400_000, 2_400_000)).toEqual({
      absDiff: 0,
      pct: 0,
      direction: 'EQUAL',
    });
    expect(offerComparison(2_600_000, 2_400_000).direction).toBe('ABOVE');
  });
  it('warns only beyond 20% (non-blocking)', () => {
    expect(offerWarning(1_900_000, 2_400_000)).toBe('LOW'); // ~21% below
    expect(offerWarning(2_000_000, 2_400_000)).toBeNull(); // ~16.7% below
    expect(offerWarning(2_900_000, 2_400_000)).toBe('HIGH'); // ~20.8% above
    expect(offerWarning(1_000, 0)).toBeNull();
  });
});

describe('expiry (§25)', () => {
  const now = new Date('2026-06-30T12:00:00.000Z');
  it('computes UTC expiry from each option', () => {
    expect(expiryFromOption('none', now)).toBeNull();
    expect(expiryFromOption('48h', now)!.toISOString()).toBe('2026-07-02T12:00:00.000Z');
    expect(expiryFromOption('3d', now)!.toISOString()).toBe('2026-07-03T12:00:00.000Z');
    expect(expiryFromOption('7d', now)!.toISOString()).toBe('2026-07-07T12:00:00.000Z');
    expect(DEFAULT_EXPIRY_OPTION).toBe('7d');
  });
  it('detects expiry at the boundary', () => {
    expect(isProposalExpired(now, now)).toBe(true); // <= now
    expect(isProposalExpired(new Date(now.getTime() + 1), now)).toBe(false);
    expect(isProposalExpired(null, now)).toBe(false);
  });
});

describe('amount normalisation + validation (§13.4 / §14.1)', () => {
  it('normalises Western + Arabic-Indic digits and separators', () => {
    expect(normalizeAmountInput('2,250,000')).toBe(2_250_000);
    expect(normalizeAmountInput('٢٢٥٠٠٠٠')).toBe(2_250_000);
    expect(normalizeAmountInput(' 1000 ')).toBe(1000);
  });
  it('rejects decimals, signs, letters, empty', () => {
    expect(normalizeAmountInput('100.5')).toBeNull();
    expect(normalizeAmountInput('-100')).toBeNull();
    expect(normalizeAmountInput('1e6')).toBeNull();
    expect(normalizeAmountInput('abc')).toBeNull();
    expect(normalizeAmountInput('')).toBeNull();
  });
  it('validates numeric amounts', () => {
    expect(validateOfferAmount(2_000_000)).toBeNull();
    expect(validateOfferAmount(null)).toBe('REQUIRED');
    expect(validateOfferAmount(0)).toBe('POSITIVE');
    expect(validateOfferAmount(-1)).toBe('POSITIVE');
    expect(validateOfferAmount(1.5)).toBe('INTEGER');
    expect(validateOfferAmount(MAX_OFFER_AED + 1)).toBe('MAX');
  });
});

describe('user-facing status mapping (§5.3)', () => {
  it('differs by perspective without leaking internal enums', () => {
    expect(userFacingStatusKey('AWAITING_SELLER', 'BUYER')).toBe('waitingSeller');
    expect(userFacingStatusKey('AWAITING_SELLER', 'SELLER')).toBe('responseNeeded');
    expect(userFacingStatusKey('AWAITING_BUYER', 'BUYER')).toBe('responseNeeded');
    expect(userFacingStatusKey('AWAITING_BUYER', 'SELLER')).toBe('waitingBuyer');
    expect(userFacingStatusKey('ACCEPTED', 'BUYER')).toBe('accepted');
  });
  it('formats buyer-safe label sequence', () => {
    expect(buyerSeqLabel(1)).toBe('01');
    expect(buyerSeqLabel(12)).toBe('12');
  });
});
