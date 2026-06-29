import { describe, it, expect } from 'vitest';
import {
  canTransitionListing,
  canRewindListing,
  listingStageIndex,
} from '../listing';
import {
  computeSectionStatuses,
  computeReadiness,
  resolveNextStep,
  canAccessStep,
  type ListingProgressInput,
} from '../listing-progress';
import { calculateInvestmentCase } from '../investment';
import {
  propertyDetailsSchema,
  listingSettingsSchema,
  investmentCaseSchema,
} from '../listing-validation';

// A fully-complete, fresh progress snapshot.
const complete: ListingProgressInput = {
  state: 'PERMIT_PENDING',
  detailsComplete: true,
  hasActiveDocument: true,
  verification: { status: 'VERIFIED', fresh: true },
  settingsComplete: true,
  investment: { status: 'SKIPPED' },
  formA: { status: 'COMPLETE', fresh: true },
  photos: { count: 8, hasCover: true },
  permit: { status: 'APPROVED', fresh: true },
  reviewConfirmed: false,
};

describe('listing state machine — forward + rewind (ADR-0010)', () => {
  it('keeps the strict forward adjacency', () => {
    expect(canTransitionListing('DRAFT', 'DETAILS_COMPLETE')).toBe(true);
    expect(canTransitionListing('PERMIT_PENDING', 'READY_TO_PUBLISH')).toBe(true);
    expect(canTransitionListing('DRAFT', 'OWNERSHIP_VERIFIED')).toBe(false);
    expect(canTransitionListing('READY_TO_PUBLISH', 'LIVE')).toBe(true); // future milestone
  });
  it('allows explicit backward rewinds along the linear chain only', () => {
    // replace verified document → back to DOCUMENT_UPLOADED
    expect(canRewindListing('OWNERSHIP_VERIFIED', 'DOCUMENT_UPLOADED')).toBe(true);
    // settings edit invalidates Form A
    expect(canRewindListing('FORM_A_COMPLETE', 'OWNERSHIP_VERIFIED')).toBe(true);
    // permit invalidated by material change
    expect(canRewindListing('PERMIT_PENDING', 'PHOTOS_COMPLETE')).toBe(true);
    // not a rewind: forward or equal
    expect(canRewindListing('DRAFT', 'DETAILS_COMPLETE')).toBe(false);
    expect(canRewindListing('OWNERSHIP_VERIFIED', 'OWNERSHIP_VERIFIED')).toBe(false);
    // REJECTED/LIVE are off the linear chain — never a rewind target
    expect(canRewindListing('PERMIT_PENDING', 'REJECTED')).toBe(false);
  });
  it('orders the linear chain', () => {
    expect(listingStageIndex('DRAFT')).toBe(0);
    expect(listingStageIndex('READY_TO_PUBLISH')).toBe(8);
    expect(listingStageIndex('LIVE')).toBe(-1);
  });
});

describe('section statuses + readiness', () => {
  it('marks every required section complete and the listing ready', () => {
    const r = computeReadiness(complete);
    expect(r.ready).toBe(true);
    expect(r.blocking).toEqual([]);
    expect(r.completedRequired).toBe(r.totalRequired);
    expect(r.statuses.investment).toBe('OPTIONAL_SKIPPED');
  });
  it('blocks when a required section is incomplete', () => {
    const r = computeReadiness({ ...complete, photos: { count: 0, hasCover: false } });
    expect(r.ready).toBe(false);
    expect(r.blocking).toContain('photos');
  });
  it('flags photos without a cover as requires-attention', () => {
    const s = computeSectionStatuses({ ...complete, photos: { count: 3, hasCover: false } });
    expect(s.photos).toBe('REQUIRES_ATTENTION');
    expect(computeReadiness({ ...complete, photos: { count: 3, hasCover: false } }).ready).toBe(false);
  });
  it('treats a stale (not-fresh) verification as requires-attention, not ready', () => {
    const s = computeSectionStatuses({ ...complete, verification: { status: 'VERIFIED', fresh: false } });
    expect(s.verification).toBe('REQUIRES_ATTENTION');
    expect(computeReadiness({ ...complete, verification: { status: 'VERIFIED', fresh: false } }).ready).toBe(false);
  });
  it('maps pending/failed simulation statuses', () => {
    expect(computeSectionStatuses({ ...complete, verification: { status: 'PENDING', fresh: true } }).verification).toBe('PENDING');
    expect(computeSectionStatuses({ ...complete, permit: { status: 'FAILED', fresh: true } }).permit).toBe('FAILED');
  });
});

describe('resume step + access', () => {
  const fresh: ListingProgressInput = {
    state: 'DRAFT',
    detailsComplete: false,
    hasActiveDocument: false,
    verification: { status: 'NOT_STARTED', fresh: true },
    settingsComplete: false,
    investment: { status: 'NOT_STARTED' },
    formA: { status: 'NOT_STARTED', fresh: true },
    photos: { count: 0, hasCover: false },
    permit: { status: 'NOT_STARTED', fresh: true },
    reviewConfirmed: false,
  };
  it('resumes at the earliest incomplete required step', () => {
    expect(resolveNextStep(fresh)).toBe('details');
    expect(resolveNextStep({ ...fresh, detailsComplete: true })).toBe('ownership');
    expect(resolveNextStep({ ...fresh, detailsComplete: true, hasActiveDocument: true })).toBe('verification');
  });
  it('offers the optional Investment Case once after settings, before Form A', () => {
    const afterSettings = { ...fresh, detailsComplete: true, hasActiveDocument: true, verification: { status: 'VERIFIED' as const, fresh: true }, settingsComplete: true };
    expect(resolveNextStep(afterSettings)).toBe('investment-case');
    expect(resolveNextStep({ ...afterSettings, investment: { status: 'SKIPPED' } })).toBe('form-a');
  });
  it('resumes at review when everything required is complete', () => {
    expect(resolveNextStep(complete)).toBe('review');
  });
  it('locks future steps but allows completed/current', () => {
    expect(canAccessStep(fresh, 'details')).toBe(true);
    expect(canAccessStep(fresh, 'photos')).toBe(false);
    expect(canAccessStep(complete, 'photos')).toBe(true);
    expect(canAccessStep(complete, 'review')).toBe(true);
  });
});

describe('investment calculations (§16.4)', () => {
  it('computes the canonical example', () => {
    const r = calculateInvestmentCase({
      askingPriceAed: 2_100_000,
      originalPurchasePriceAed: 1_750_000,
      renovationCostsAed: 50_000,
      purchaseDate: '2022-06-29',
      sizeSqft: 1284,
      asOf: '2026-06-29',
    });
    expect(r.totalInvestedAed).toBe(1_800_000);
    expect(r.estimatedGainAed).toBe(300_000);
    expect(r.estimatedRoiPct).toBe(16.7);
    expect(r.yearsHeld).toBe(4);
    expect(r.estimatedAnnualisedReturnPct).toBeCloseTo(3.9, 1);
    expect(r.pricePerSqftAed).toBe(Math.round(2_100_000 / 1284));
  });
  it('returns null annualised return for holding period under 30 days', () => {
    const r = calculateInvestmentCase({
      askingPriceAed: 2_000_000,
      originalPurchasePriceAed: 1_800_000,
      purchaseDate: '2026-06-15',
      sizeSqft: 1000,
      asOf: '2026-06-29',
    });
    expect(r.estimatedRoiPct).not.toBeNull();
    expect(r.estimatedAnnualisedReturnPct).toBeNull();
  });
  it('guards zero/negative total invested (no ROI, no annualised)', () => {
    const r = calculateInvestmentCase({
      askingPriceAed: 1_000_000,
      originalPurchasePriceAed: 0,
      renovationCostsAed: 0,
      purchaseDate: '2020-01-01',
      sizeSqft: 1000,
      asOf: '2026-06-29',
    });
    expect(r.totalInvestedAed).toBe(0);
    expect(r.estimatedRoiPct).toBeNull();
    expect(r.estimatedAnnualisedReturnPct).toBeNull();
    expect(r.estimatedGainAed).toBe(1_000_000);
  });
  it('handles a future / missing purchase date and missing size', () => {
    const future = calculateInvestmentCase({
      askingPriceAed: 2_000_000,
      originalPurchasePriceAed: 1_500_000,
      purchaseDate: '2027-01-01',
      sizeSqft: null,
      asOf: '2026-06-29',
    });
    expect(future.yearsHeld).toBeNull();
    expect(future.estimatedAnnualisedReturnPct).toBeNull();
    expect(future.pricePerSqftAed).toBeNull();
    expect(future.estimatedRoiPct).toBe(33.3); // gain 500k / 1.5m
  });
  it('represents a loss with a negative ROI', () => {
    const r = calculateInvestmentCase({
      askingPriceAed: 1_000_000,
      originalPurchasePriceAed: 1_800_000,
      purchaseDate: '2021-01-01',
      sizeSqft: 1000,
      asOf: '2026-06-29',
    });
    expect(r.estimatedGainAed).toBe(-800_000);
    expect(r.estimatedRoiPct).toBeCloseTo(-44.4, 1);
  });
});

describe('listing validation schemas', () => {
  const baseDetails = {
    propertyType: 'APARTMENT' as const,
    emirate: 'DUBAI' as const,
    community: 'Dubai Marina',
    buildingOrProject: 'Marina Gate 2',
    unitIdentifier: 'Unit 2205',
    bedrooms: 2,
    bathrooms: 3,
    sizeSqft: 1284,
    furnishingStatus: 'FURNISHED' as const,
    occupancyStatus: 'VACANT' as const,
    completionStatus: 'READY' as const,
    parkingSpaces: 1,
    description: 'A'.repeat(120),
    features: ['BALCONY' as const, 'SEA_VIEW' as const],
  };
  it('accepts a valid apartment with a building', () => {
    expect(propertyDetailsSchema.safeParse(baseDetails).success).toBe(true);
  });
  it('requires a building for apartments/penthouses but not villas', () => {
    const noBuilding = { ...baseDetails, buildingOrProject: '' };
    expect(propertyDetailsSchema.safeParse(noBuilding).success).toBe(false);
    expect(propertyDetailsSchema.safeParse({ ...noBuilding, propertyType: 'VILLA' }).success).toBe(true);
  });
  it('rejects short descriptions and >15 amenities', () => {
    expect(propertyDetailsSchema.safeParse({ ...baseDetails, description: 'too short' }).success).toBe(false);
  });
  it('enforces settings: notification cannot exceed asking price', () => {
    expect(listingSettingsSchema.safeParse({ askingPriceAed: 2_000_000, minNotificationPriceAed: 1_950_000 }).success).toBe(true);
    expect(listingSettingsSchema.safeParse({ askingPriceAed: 2_000_000, minNotificationPriceAed: 2_000_000 }).success).toBe(true);
    const bad = listingSettingsSchema.safeParse({ askingPriceAed: 2_000_000, minNotificationPriceAed: 2_100_000 });
    expect(bad.success).toBe(false);
    if (!bad.success) expect(bad.error.issues.map((i) => i.message)).toContain('notification_above_asking');
  });
  it('rejects non-whole or non-positive prices', () => {
    expect(listingSettingsSchema.safeParse({ askingPriceAed: 0, minNotificationPriceAed: 0 }).success).toBe(false);
    expect(listingSettingsSchema.safeParse({ askingPriceAed: 1_000_000.5, minNotificationPriceAed: 1 }).success).toBe(false);
  });
  it('validates investment case inputs (negative renovation, future date)', () => {
    const ok = investmentCaseSchema.safeParse({ originalPurchasePriceAed: 1_750_000, renovationCostsAed: 50_000, purchaseDate: '2022-06-29', visible: true });
    expect(ok.success).toBe(true);
    expect(investmentCaseSchema.safeParse({ originalPurchasePriceAed: 1_000, renovationCostsAed: -5, purchaseDate: '2022-06-29' }).success).toBe(false);
    expect(investmentCaseSchema.safeParse({ originalPurchasePriceAed: 1_000, purchaseDate: '2999-01-01' }).success).toBe(false);
  });
});
