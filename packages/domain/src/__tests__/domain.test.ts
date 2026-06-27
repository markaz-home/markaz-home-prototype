import { describe, it, expect } from 'vitest';
import {
  isAccountTypeChangeAllowed,
  canSelfAssignAccountType,
  DEFAULT_ACCOUNT_TYPE,
} from '../account';
import { canTransitionIdentity, isIdentityVerified } from '../identity';
import { isProfileComplete } from '../profile';
import { resolvePostAuthDestination } from '../routing';
import { canTransitionListing, isPubliclyVisible } from '../listing';
import { canSubmitOffer, isBelowThreshold, canTransitionOffer } from '../offer';
import { canAdvanceTransaction, nextStage } from '../transaction';

describe('account-type rules', () => {
  it('defaults to CUSTOMER', () => {
    expect(DEFAULT_ACCOUNT_TYPE).toBe('CUSTOMER');
  });
  it('allows staying CUSTOMER but blocks self-promotion to ADMIN', () => {
    expect(canSelfAssignAccountType('CUSTOMER')).toBe(true);
    expect(canSelfAssignAccountType('ADMIN')).toBe(false);
    expect(isAccountTypeChangeAllowed('CUSTOMER', 'CUSTOMER')).toBe(true);
    expect(isAccountTypeChangeAllowed('CUSTOMER', 'ADMIN')).toBe(false);
    expect(isAccountTypeChangeAllowed('CUSTOMER', undefined)).toBe(true);
  });
});

describe('identity machine', () => {
  it('follows the simulated UAE PASS transitions', () => {
    expect(canTransitionIdentity('NOT_STARTED', 'PENDING')).toBe(true);
    expect(canTransitionIdentity('PENDING', 'VERIFIED_DEMO')).toBe(true);
    expect(canTransitionIdentity('PENDING', 'FAILED_DEMO')).toBe(true);
    expect(canTransitionIdentity('FAILED_DEMO', 'PENDING')).toBe(true);
    expect(canTransitionIdentity('NOT_STARTED', 'VERIFIED_DEMO')).toBe(false);
    expect(isIdentityVerified('VERIFIED_DEMO')).toBe(true);
  });
});

describe('profile completeness + post-auth routing', () => {
  const complete = {
    fullName: 'Demo Customer',
    termsAcceptedAt: '2026-01-01T00:00:00.000Z',
    privacyAcceptedAt: '2026-01-01T00:00:00.000Z',
  };

  it('detects completeness', () => {
    expect(isProfileComplete(complete)).toBe(true);
    expect(isProfileComplete({ ...complete, fullName: null })).toBe(false);
    expect(isProfileComplete({ ...complete, termsAcceptedAt: null })).toBe(false);
  });

  it('routes a brand-new user to profile setup', () => {
    expect(resolvePostAuthDestination(null)).toBe('profile-setup');
  });
  it('routes an incomplete profile to profile setup', () => {
    expect(
      resolvePostAuthDestination({ ...complete, fullName: null, identityVerificationStatus: 'NOT_STARTED' }),
    ).toBe('profile-setup');
  });
  it('routes a complete-but-unverified profile to UAE PASS', () => {
    expect(
      resolvePostAuthDestination({ ...complete, identityVerificationStatus: 'NOT_STARTED' }),
    ).toBe('uae-pass');
  });
  it('routes a verified returning customer straight to the dashboard', () => {
    expect(
      resolvePostAuthDestination({ ...complete, identityVerificationStatus: 'VERIFIED_DEMO' }),
    ).toBe('dashboard');
  });
});

describe('listing machine', () => {
  it('walks the happy path to LIVE', () => {
    expect(canTransitionListing('DRAFT', 'DETAILS_COMPLETE')).toBe(true);
    expect(canTransitionListing('READY_TO_PUBLISH', 'LIVE')).toBe(true);
    expect(canTransitionListing('LIVE', 'SOLD_DEMO')).toBe(true);
    expect(canTransitionListing('DRAFT', 'LIVE')).toBe(false);
    expect(isPubliclyVisible('LIVE')).toBe(true);
    expect(isPubliclyVisible('DRAFT')).toBe(false);
  });
});

describe('offer rules', () => {
  it('prevents offering on your own listing', () => {
    expect(canSubmitOffer({ offeringUserId: 'a', listingOwnerId: 'b' })).toBe(true);
    expect(canSubmitOffer({ offeringUserId: 'a', listingOwnerId: 'a' })).toBe(false);
  });
  it('applies the notification threshold', () => {
    expect(isBelowThreshold(900_000, 1_000_000)).toBe(true);
    expect(isBelowThreshold(1_200_000, 1_000_000)).toBe(false);
    expect(isBelowThreshold(900_000, null)).toBe(false);
  });
  it('validates offer transitions', () => {
    expect(canTransitionOffer('SUBMITTED', 'UNDER_REVIEW')).toBe(true);
    expect(canTransitionOffer('ACCEPTED_AS_PREFERRED', 'REJECTED')).toBe(false);
  });
});

describe('transaction machine', () => {
  it('advances strictly forward', () => {
    expect(canAdvanceTransaction('ACCEPTANCE', 'MOU')).toBe(true);
    expect(canAdvanceTransaction('ACCEPTANCE', 'DEPOSIT')).toBe(false);
    expect(nextStage('HANDOVER')).toBe('COMPLETE_DEMO');
    expect(nextStage('COMPLETE_DEMO')).toBeNull();
  });
});
