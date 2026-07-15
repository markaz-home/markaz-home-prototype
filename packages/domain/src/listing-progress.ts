import { z } from 'zod';
import type { ListingState } from './listing';

/**
 * Derived wizard progress for the property-listing journey (design spec §4.2,
 * §6, §10, §11, §20). These are PURE functions: the server builds a normalised
 * snapshot from the database and derives section statuses, the resume step, and
 * the READY_TO_PUBLISH readiness gate. The customer never supplies these.
 */

// Wizard step keys map 1:1 to the §6.1 route segments.
export const WIZARD_STEPS = [
  'details',
  'ownership',
  'verification',
  'settings',
  'investment-case',
  'form-a',
  'photos',
  'trakheesi',
  'review',
] as const;
export type WizardStep = (typeof WIZARD_STEPS)[number];

// §4.2 derived section statuses (drive the stepper + Review; not the DB state).
export const SECTION_STATUSES = [
  'NOT_STARTED',
  'IN_PROGRESS',
  'COMPLETE',
  'OPTIONAL_SKIPPED',
  'PENDING',
  'FAILED',
  'REQUIRES_ATTENTION',
] as const;
export type SectionStatus = (typeof SECTION_STATUSES)[number];

// Sections shown on the stepper + Review (investment is optional; review is the
// final confirm action and is not a blocking required section itself).
export const LISTING_SECTIONS = [
  'details',
  'ownership',
  'verification',
  'settings',
  'investment',
  'formA',
  'photos',
  'permit',
] as const;
export type ListingSection = (typeof LISTING_SECTIONS)[number];

/** Required sections that gate READY_TO_PUBLISH (investment is optional). */
export const REQUIRED_SECTIONS: readonly ListingSection[] = [
  'details',
  'ownership',
  'verification',
  'settings',
  'formA',
  'photos',
  'permit',
];

export const PHOTO_MIN = 1;
export const PHOTO_MAX = 20;
export const PHOTO_RECOMMENDED = 5;

export type SimpleSimStatus = 'NOT_STARTED' | 'PENDING' | 'COMPLETE' | 'FAILED';

/**
 * Normalised snapshot the API builds from DB rows. `fresh` means the record was
 * produced after the most recent invalidating edit to its inputs (ADR-0010).
 */
export interface ListingProgressInput {
  state: ListingState;
  detailsComplete: boolean;
  hasActiveDocument: boolean;
  verification: { status: 'NOT_STARTED' | 'PENDING' | 'VERIFIED' | 'FAILED'; fresh: boolean };
  settingsComplete: boolean;
  investment: { status: 'NOT_STARTED' | 'ADDED' | 'SKIPPED' };
  formA: { status: SimpleSimStatus; fresh: boolean };
  photos: { count: number; hasCover: boolean };
  permit: { status: 'NOT_STARTED' | 'PENDING' | 'APPROVED' | 'FAILED'; fresh: boolean };
  reviewConfirmed: boolean;
}

export type SectionStatusMap = Record<ListingSection, SectionStatus>;

function detailsStatus(i: ListingProgressInput): SectionStatus {
  return i.detailsComplete ? 'COMPLETE' : 'NOT_STARTED';
}
function ownershipStatus(i: ListingProgressInput): SectionStatus {
  return i.hasActiveDocument ? 'COMPLETE' : 'NOT_STARTED';
}
function verificationStatus(i: ListingProgressInput): SectionStatus {
  const v = i.verification;
  if (v.status === 'VERIFIED') return v.fresh ? 'COMPLETE' : 'REQUIRES_ATTENTION';
  if (v.status === 'PENDING') return 'PENDING';
  if (v.status === 'FAILED') return 'FAILED';
  return 'NOT_STARTED';
}
function settingsStatus(i: ListingProgressInput): SectionStatus {
  return i.settingsComplete ? 'COMPLETE' : 'NOT_STARTED';
}
function investmentStatus(i: ListingProgressInput): SectionStatus {
  if (i.investment.status === 'ADDED') return 'COMPLETE';
  if (i.investment.status === 'SKIPPED') return 'OPTIONAL_SKIPPED';
  return 'NOT_STARTED';
}
function formAStatus(i: ListingProgressInput): SectionStatus {
  const f = i.formA;
  if (f.status === 'COMPLETE') return f.fresh ? 'COMPLETE' : 'REQUIRES_ATTENTION';
  if (f.status === 'PENDING') return 'PENDING';
  if (f.status === 'FAILED') return 'FAILED';
  return 'NOT_STARTED';
}
function photosStatus(i: ListingProgressInput): SectionStatus {
  if (i.photos.count <= 0) return 'NOT_STARTED';
  if (!i.photos.hasCover) return 'REQUIRES_ATTENTION';
  return 'COMPLETE';
}
function permitStatus(i: ListingProgressInput): SectionStatus {
  const p = i.permit;
  if (p.status === 'APPROVED') return p.fresh ? 'COMPLETE' : 'REQUIRES_ATTENTION';
  if (p.status === 'PENDING') return 'PENDING';
  if (p.status === 'FAILED') return 'FAILED';
  return 'NOT_STARTED';
}

export function computeSectionStatuses(input: ListingProgressInput): SectionStatusMap {
  return {
    details: detailsStatus(input),
    ownership: ownershipStatus(input),
    verification: verificationStatus(input),
    settings: settingsStatus(input),
    investment: investmentStatus(input),
    formA: formAStatus(input),
    photos: photosStatus(input),
    permit: permitStatus(input),
  };
}

export interface ListingReadiness {
  ready: boolean;
  completedRequired: number;
  totalRequired: number;
  blocking: ListingSection[];
  statuses: SectionStatusMap;
}

/**
 * Server-authoritative READY_TO_PUBLISH gate. The listing is ready only when
 * every required section is COMPLETE. Investment Case is optional and excluded.
 */
export function computeReadiness(input: ListingProgressInput): ListingReadiness {
  const statuses = computeSectionStatuses(input);
  const blocking = REQUIRED_SECTIONS.filter((s) => statuses[s] !== 'COMPLETE');
  return {
    ready: blocking.length === 0,
    completedRequired: REQUIRED_SECTIONS.length - blocking.length,
    totalRequired: REQUIRED_SECTIONS.length,
    blocking,
    statuses,
  };
}

/**
 * The step a customer should resume on: the earliest incomplete required step.
 * The optional Investment Case is offered once (after Settings) before Form A.
 * When everything required is complete, resume on Review.
 */
export function resolveNextStep(input: ListingProgressInput): WizardStep {
  const s = computeSectionStatuses(input);
  if (s.details !== 'COMPLETE') return 'details';
  if (s.ownership !== 'COMPLETE') return 'ownership';
  if (s.verification !== 'COMPLETE') return 'verification';
  if (s.settings !== 'COMPLETE') return 'settings';
  // The optional Investment Case is offered exactly once, between Settings and
  // Form A. Once Form A is complete we never route back to it.
  if (s.formA !== 'COMPLETE') {
    if (input.investment.status === 'NOT_STARTED') return 'investment-case';
    return 'form-a';
  }
  if (s.photos !== 'COMPLETE') return 'photos';
  if (s.permit !== 'COMPLETE') return 'trakheesi';
  return 'review';
}

/**
 * Whether a customer may directly open a step: completed and current steps are
 * accessible; future steps are locked until prerequisites are met. Uses the full
 * wizard order (investment-case sits after settings).
 */
export function canAccessStep(input: ListingProgressInput, step: WizardStep): boolean {
  const furthest = resolveNextStep(input);
  return WIZARD_STEPS.indexOf(step) <= WIZARD_STEPS.indexOf(furthest);
}

export const wizardStepSchema = z.enum(WIZARD_STEPS);
