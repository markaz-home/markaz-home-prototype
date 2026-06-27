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
