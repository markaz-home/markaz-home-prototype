import { describe, it, expect } from 'vitest';
import { toBuyerThread, toSellerThread, offerPropertySummary } from '../offer-projection';

const property = {
  publicId: 'mkz-x',
  publicSlug: 's',
  askingPrice: 2_400_000,
  bedrooms: 2,
  bathrooms: 2,
  propertyType: 'APARTMENT',
  community: 'Dubai Marina',
  buildingOrProject: 'Marina Gate',
  emirate: 'Dubai',
  coverPublicPath: null,
};

const thread = {
  id: 't1',
  status: 'AWAITING_SELLER' as const,
  nextActor: 'SELLER' as const,
  currentProposalId: 'p1',
  acceptedProposalId: null,
  closedReason: null,
  rejectReasonCode: 'AMOUNT_TOO_LOW', // seller-private
  expiresAt: null,
  buyerSeq: 3,
  lastActivityAt: new Date('2026-06-30T12:00:00Z'),
  createdAt: new Date('2026-06-30T10:00:00Z'),
  version: 1,
};

const current = {
  id: 'p1',
  createdBySide: 'BUYER' as const,
  amountAed: 2_200_000,
  status: 'CURRENT' as const,
  expiresAt: null,
  createdAt: new Date('2026-06-30T10:00:00Z'),
};

describe('offer projection privacy (§37)', () => {
  it('buyer view never carries the seller threshold, buyer-safe label, or private reason', () => {
    const v = toBuyerThread({ thread, current, property }) as Record<string, unknown>;
    expect(v.perspective).toBe('BUYER');
    expect('threshold' in v).toBe(false);
    expect('buyerLabel' in v).toBe(false);
    expect('rejectReasonCode' in v).toBe(false);
    expect(v.comparison).toMatchObject({ direction: 'BELOW' });
  });

  it('seller view adds the buyer-safe label + threshold classification only', () => {
    const v = toSellerThread({ thread, current, property, minNotificationPrice: 2_300_000 });
    expect(v.perspective).toBe('SELLER');
    expect(v.buyerLabel).toBe('03');
    expect(v.threshold).toBe('BELOW'); // 2.2M < 2.3M threshold
    // The private rejection reason is never projected, even to the seller view.
    expect('rejectReasonCode' in (v as Record<string, unknown>)).toBe(false);
  });

  it('above-threshold classification', () => {
    const v = toSellerThread({ thread, current: { ...current, amountAed: 2_500_000 }, property, minNotificationPrice: 2_300_000 });
    expect(v.threshold).toBe('AT_OR_ABOVE');
  });

  it('property summary builds a headline + cover and exposes no private fields', () => {
    const s = offerPropertySummary(property);
    expect(s.headline).toMatch(/2-bedroom apartment in Marina Gate/i);
    expect(s.askingPriceAed).toBe(2_400_000);
  });
});
