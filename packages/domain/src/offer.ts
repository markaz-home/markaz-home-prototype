import { z } from 'zod';

export const OFFER_STATES = [
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'COUNTERED',
  'ACCEPTED_AS_PREFERRED',
  'REJECTED',
  'EXPIRED',
  'WITHDRAWN',
] as const;
export type OfferState = (typeof OFFER_STATES)[number];
export const offerStateSchema = z.enum(OFFER_STATES);

const OFFER_TRANSITIONS: Record<OfferState, OfferState[]> = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['UNDER_REVIEW', 'EXPIRED', 'WITHDRAWN'],
  UNDER_REVIEW: ['COUNTERED', 'ACCEPTED_AS_PREFERRED', 'REJECTED', 'EXPIRED', 'WITHDRAWN'],
  COUNTERED: ['UNDER_REVIEW', 'ACCEPTED_AS_PREFERRED', 'REJECTED', 'EXPIRED', 'WITHDRAWN'],
  ACCEPTED_AS_PREFERRED: [],
  REJECTED: [],
  EXPIRED: [],
  WITHDRAWN: [],
};

export function canTransitionOffer(from: OfferState, to: OfferState): boolean {
  return OFFER_TRANSITIONS[from].includes(to);
}

/**
 * Hard product rule (§6A.6): a customer can NEVER offer on a listing they own.
 * Enforced in the API and in RLS policy; surfaced in the UI; covered by tests.
 */
export function canSubmitOffer(params: {
  offeringUserId: string;
  listingOwnerId: string;
}): boolean {
  return params.offeringUserId !== params.listingOwnerId;
}

/**
 * Threshold rule: an offer below the listing's minNotificationPrice is recorded
 * as "below threshold" and produces no seller notification.
 */
export function isBelowThreshold(amount: number, minNotificationPrice: number | null): boolean {
  if (minNotificationPrice == null) return false;
  return amount < minNotificationPrice;
}
