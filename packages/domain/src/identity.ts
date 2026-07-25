import { z } from 'zod';

/** Identity outcomes persisted on the customer's profile. */
export const IDENTITY_STATUSES = [
  'NOT_STARTED',
  'PENDING',
  'VERIFIED_DEMO',
  'FAILED_DEMO',
  'VERIFIED_STAGING',
] as const;
export type IdentityVerificationStatus = (typeof IDENTITY_STATUSES)[number];
export const identityStatusSchema = z.enum(IDENTITY_STATUSES);

/**
 * Values accepted by the browser-driven simulation mutation. VERIFIED_STAGING
 * is deliberately absent: only the provider-derived server mutation may record
 * a real staging link.
 */
export const SIMULATED_IDENTITY_STATUSES = [
  'NOT_STARTED',
  'PENDING',
  'VERIFIED_DEMO',
  'FAILED_DEMO',
] as const;
export type SimulatedIdentityStatus = (typeof SIMULATED_IDENTITY_STATUSES)[number];
export const simulatedIdentityStatusSchema = z.enum(SIMULATED_IDENTITY_STATUSES);

type Transition = Record<IdentityVerificationStatus, IdentityVerificationStatus[]>;

/** Allowed transitions for the simulation and the provider-derived staging result. */
const IDENTITY_TRANSITIONS: Transition = {
  NOT_STARTED: ['PENDING', 'VERIFIED_STAGING'],
  PENDING: ['VERIFIED_DEMO', 'FAILED_DEMO', 'VERIFIED_STAGING'],
  FAILED_DEMO: ['PENDING', 'VERIFIED_STAGING'], // Retry simulation or use UAE PASS Staging
  VERIFIED_DEMO: [], // terminal for the demo
  VERIFIED_STAGING: [], // terminal for the recorded staging link
};

export function canTransitionIdentity(
  from: IdentityVerificationStatus,
  to: IdentityVerificationStatus,
): boolean {
  return IDENTITY_TRANSITIONS[from].includes(to);
}

export function isIdentityVerified(status: IdentityVerificationStatus): boolean {
  return status === 'VERIFIED_DEMO' || status === 'VERIFIED_STAGING';
}
