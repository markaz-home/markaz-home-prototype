import { describe, it, expect } from 'vitest';
import {
  isAccountTypeChangeAllowed,
  canSelfAssignAccountType,
  DEFAULT_ACCOUNT_TYPE,
} from '../account';
import { canTransitionIdentity, isIdentityVerified } from '../identity';
import { isProfileComplete } from '../profile';
import { resolvePostAuthDestination } from '../routing';
import {
  normalizeEmail,
  passwordMeetsPolicy,
  checkPasswordRequirements,
  signUpSchema,
  passwordSchema,
  resetPasswordSchema,
  PASSWORD_MIN,
  PASSWORD_MAX,
  mapAuthError,
  isLikelyExistingAccount,
  isExistingAccountError,
} from '../auth';
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

  it('routes an unverified email to verify-email first', () => {
    expect(
      resolvePostAuthDestination({
        emailVerified: false,
        profile: { ...complete, identityVerificationStatus: 'VERIFIED_DEMO' },
      }),
    ).toBe('verify-email');
  });
  it('routes a verified user with no profile to profile setup', () => {
    expect(resolvePostAuthDestination({ emailVerified: true, profile: null })).toBe('profile-setup');
  });
  it('routes a verified incomplete profile to profile setup', () => {
    expect(
      resolvePostAuthDestination({
        emailVerified: true,
        profile: { ...complete, fullName: null, identityVerificationStatus: 'NOT_STARTED' },
      }),
    ).toBe('profile-setup');
  });
  it('routes complete-but-unverified-identity to UAE PASS (incl. PENDING/FAILED resume)', () => {
    for (const s of ['NOT_STARTED', 'PENDING', 'FAILED_DEMO'] as const) {
      expect(
        resolvePostAuthDestination({
          emailVerified: true,
          profile: { ...complete, identityVerificationStatus: s },
        }),
      ).toBe('uae-pass');
    }
  });
  it('routes a fully-onboarded customer to the dashboard', () => {
    expect(
      resolvePostAuthDestination({
        emailVerified: true,
        profile: { ...complete, identityVerificationStatus: 'VERIFIED_DEMO' },
      }),
    ).toBe('dashboard');
  });
});

describe('auth helpers', () => {
  it('normalises emails', () => {
    expect(normalizeEmail('  Tania@Example.COM ')).toBe('tania@example.com');
  });
  it('enforces the password policy', () => {
    expect(passwordMeetsPolicy('Weakpass1')).toBe(false); // no special
    expect(passwordMeetsPolicy('short1!A')).toBe(true);
    expect(passwordMeetsPolicy('nouppercase1!')).toBe(false);
    expect(passwordMeetsPolicy('Aa1!aaaa')).toBe(true);
    const r = checkPasswordRequirements('Aa1!aaaa');
    expect(r).toEqual({ minLength: true, uppercase: true, lowercase: true, number: true, special: true });
  });
  it('enforces password length bounds: min 8, max 128 (ADR-0009, no silent truncation)', () => {
    expect(PASSWORD_MIN).toBe(8);
    expect(PASSWORD_MAX).toBe(128);
    // Too short → password_too_short (fails min before policy).
    const short = passwordSchema.safeParse('Aa1!aaa'); // 7 chars
    expect(short.success).toBe(false);
    if (!short.success) expect(short.error.issues.map((i) => i.message)).toContain('password_too_short');
    // Exactly 128 valid chars → accepted (boundary).
    const at128 = `Aa1!${'a'.repeat(124)}`;
    expect(at128.length).toBe(128);
    expect(passwordSchema.safeParse(at128).success).toBe(true);
    // 129 chars → rejected with password_too_long, never truncated.
    const over = `Aa1!${'a'.repeat(125)}`;
    expect(over.length).toBe(129);
    const overRes = passwordSchema.safeParse(over);
    expect(overRes.success).toBe(false);
    if (!overRes.success) expect(overRes.error.issues.map((i) => i.message)).toContain('password_too_long');
  });
  it('reset-password schema requires a matching confirmation (no recovery-code field)', () => {
    const pw = 'NewMarkaz!2';
    expect(resetPasswordSchema.safeParse({ password: pw, confirmPassword: pw }).success).toBe(true);
    const mismatch = resetPasswordSchema.safeParse({ password: pw, confirmPassword: 'Other!23' });
    expect(mismatch.success).toBe(false);
    if (!mismatch.success) expect(mismatch.error.issues.map((i) => i.message)).toContain('password_mismatch');
  });
  it('validates the sign-up schema incl. confirm + consent', () => {
    const base = {
      fullName: 'محمد علي',
      email: 'New@Markaz.Demo',
      password: 'Aa1!aaaa',
      confirmPassword: 'Aa1!aaaa',
      acceptTerms: true,
      acceptPrivacy: true,
    };
    const ok = signUpSchema.safeParse(base);
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.email).toBe('new@markaz.demo'); // normalised, Arabic name allowed
    expect(signUpSchema.safeParse({ ...base, confirmPassword: 'different' }).success).toBe(false);
    expect(signUpSchema.safeParse({ ...base, acceptTerms: false }).success).toBe(false);
  });
  it('maps provider errors to safe, non-enumerating keys', () => {
    expect(mapAuthError({ message: 'Invalid login credentials' })).toBe('invalid_credentials');
    expect(mapAuthError({ message: 'Email not confirmed' })).toBe('email_not_confirmed');
    expect(mapAuthError({ status: 429 })).toBe('rate_limited');
    expect(mapAuthError({ message: 'Token has expired' })).toBe('expired_code');
  });
  it('detects the anti-enumeration existing-account signal', () => {
    expect(isLikelyExistingAccount({ identities: [] })).toBe(true);
    expect(isLikelyExistingAccount({ identities: [{ id: 'x' }] })).toBe(false);
    expect(isLikelyExistingAccount(null)).toBe(false);
  });
  it('detects an explicit user_already_exists / email_exists error', () => {
    expect(isExistingAccountError({ code: 'user_already_exists', status: 422 })).toBe(true);
    expect(isExistingAccountError({ code: 'email_exists' })).toBe(true);
    expect(isExistingAccountError({ message: 'User already registered' })).toBe(true);
    expect(isExistingAccountError({ message: 'Invalid login credentials' })).toBe(false);
    expect(isExistingAccountError(null)).toBe(false);
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
