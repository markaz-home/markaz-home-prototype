import { z } from 'zod';

/**
 * Simulated UAE PASS identity status. Persisted on the real profiles row.
 * This prototype is NOT connected to the live UAE PASS service.
 */
export const IDENTITY_STATUSES = [
  'NOT_STARTED',
  'PENDING',
  'VERIFIED_DEMO',
  'FAILED_DEMO',
] as const;
export type IdentityVerificationStatus = (typeof IDENTITY_STATUSES)[number];
export const identityStatusSchema = z.enum(IDENTITY_STATUSES);

type Transition = Record<IdentityVerificationStatus, IdentityVerificationStatus[]>;

/** Allowed transitions for the simulated identity flow. */
const IDENTITY_TRANSITIONS: Transition = {
  NOT_STARTED: ['PENDING'],
  PENDING: ['VERIFIED_DEMO', 'FAILED_DEMO'],
  FAILED_DEMO: ['PENDING'], // Try Again
  VERIFIED_DEMO: [], // terminal for the demo
};

export function canTransitionIdentity(
  from: IdentityVerificationStatus,
  to: IdentityVerificationStatus,
): boolean {
  return IDENTITY_TRANSITIONS[from].includes(to);
}

export function isIdentityVerified(status: IdentityVerificationStatus): boolean {
  return status === 'VERIFIED_DEMO';
}
