import { z } from 'zod';

/** Listing lifecycle (full machine; the listing wizard arrives next milestone). */
export const LISTING_STATES = [
  'DRAFT',
  'DETAILS_COMPLETE',
  'DOCUMENT_UPLOADED',
  'OWNERSHIP_REVIEW',
  'OWNERSHIP_VERIFIED',
  'FORM_A_COMPLETE',
  'PHOTOS_COMPLETE',
  'PERMIT_PENDING',
  'READY_TO_PUBLISH',
  'LIVE',
  'PAUSED',
  'REJECTED',
  'SOLD_DEMO',
] as const;
export type ListingState = (typeof LISTING_STATES)[number];
export const listingStateSchema = z.enum(LISTING_STATES);

const LISTING_TRANSITIONS: Record<ListingState, ListingState[]> = {
  DRAFT: ['DETAILS_COMPLETE', 'REJECTED'],
  DETAILS_COMPLETE: ['DOCUMENT_UPLOADED', 'REJECTED'],
  DOCUMENT_UPLOADED: ['OWNERSHIP_REVIEW', 'REJECTED'],
  OWNERSHIP_REVIEW: ['OWNERSHIP_VERIFIED', 'REJECTED'],
  OWNERSHIP_VERIFIED: ['FORM_A_COMPLETE', 'REJECTED'],
  FORM_A_COMPLETE: ['PHOTOS_COMPLETE', 'REJECTED'],
  PHOTOS_COMPLETE: ['PERMIT_PENDING', 'REJECTED'],
  PERMIT_PENDING: ['READY_TO_PUBLISH', 'REJECTED'],
  READY_TO_PUBLISH: ['LIVE', 'REJECTED'],
  LIVE: ['PAUSED', 'SOLD_DEMO', 'REJECTED'],
  PAUSED: ['LIVE', 'REJECTED'],
  REJECTED: [],
  SOLD_DEMO: [],
};

export function canTransitionListing(from: ListingState, to: ListingState): boolean {
  return LISTING_TRANSITIONS[from].includes(to);
}

/** Only LIVE listings are visible to the public. */
export function isPubliclyVisible(state: ListingState): boolean {
  return state === 'LIVE';
}

// --- Week-2 wizard rewind/invalidation (ADR-0010) --------------------------
// The forward machine above is strict adjacency. A retryable prototype also
// needs explicit, server-only BACKWARD moves so that invalidating edits (e.g.
// replacing a verified document, or editing settings after Simulated Form A)
// rewind the listing to the correct milestone instead of hiding the change.
// A failed simulation does NOT rewind and does NOT go to REJECTED — the listing
// stays on its current state and the *record* carries the FAILED status
// (see verifications / permit_records). REJECTED is reserved for a future Admin
// decision and is never reached by the customer wizard.

/** The linear Week-2 setup chain, in order, ending at READY_TO_PUBLISH. */
export const LISTING_LINEAR_ORDER = [
  'DRAFT',
  'DETAILS_COMPLETE',
  'DOCUMENT_UPLOADED',
  'OWNERSHIP_REVIEW',
  'OWNERSHIP_VERIFIED',
  'FORM_A_COMPLETE',
  'PHOTOS_COMPLETE',
  'PERMIT_PENDING',
  'READY_TO_PUBLISH',
] as const satisfies readonly ListingState[];

export type LinearListingState = (typeof LISTING_LINEAR_ORDER)[number];

export function listingStageIndex(state: ListingState): number {
  return (LISTING_LINEAR_ORDER as readonly ListingState[]).indexOf(state);
}

/**
 * A rewind is an explicit backward move along the linear setup chain, used when
 * an invalidating edit makes a later milestone no longer valid. Both states must
 * be on the linear chain and `to` must be strictly earlier than `from`.
 * Rewinds are applied only by authorised server procedures.
 */
export function canRewindListing(from: ListingState, to: ListingState): boolean {
  const fromIdx = listingStageIndex(from);
  const toIdx = listingStageIndex(to);
  return fromIdx > 0 && toIdx >= 0 && toIdx < fromIdx;
}
