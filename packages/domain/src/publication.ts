import { z } from 'zod';
import type { ListingState } from './listing';
import { computeReadiness, type ListingProgressInput } from './listing-progress';

/**
 * Publication + live-listing domain logic (Week 3, design spec §4, §5, §13, §17).
 * Pure functions. The listing state enum stays {READY_TO_PUBLISH, LIVE, PAUSED}
 * for this milestone; publication review lives in a SEPARATE request status so a
 * returned review never corrupts the listing journey (§5.1).
 */

// --- Publication-request status (separate record; §4.2) ----------------------
export const PUBLICATION_REQUEST_STATUSES = [
  'NOT_SUBMITTED',
  'PENDING',
  'APPROVED_DEMO',
  'REJECTED_DEMO',
] as const;
export type PublicationRequestStatus = (typeof PUBLICATION_REQUEST_STATUSES)[number];
export const publicationRequestStatusSchema = z.enum(PUBLICATION_REQUEST_STATUSES);

/** Safe customer-facing outcome categories — never raw notes/paths (§5.3). */
export const PUBLICATION_RESULT_CATEGORIES = [
  'LISTING_CHANGED',
  'PHOTO_PROCESSING_FAILED',
  'CHECKLIST_INCOMPLETE',
  'DEMO_REVIEW_RETURNED',
  'PROCESSING_ERROR',
] as const;
export type PublicationResultCategory = (typeof PUBLICATION_RESULT_CATEGORIES)[number];

// --- Publication checklist (§13.2) ------------------------------------------
export const PUBLICATION_CHECKLIST_ITEMS = [
  'details',
  'ownership',
  'price',
  'formA',
  'photos',
  'cover',
  'permit',
  'privacy',
  'investmentVisibility',
] as const;
export type PublicationChecklistItem = (typeof PUBLICATION_CHECKLIST_ITEMS)[number];

export type ChecklistStatus = 'COMPLETE' | 'INCOMPLETE' | 'OPTIONAL';

/** Pure checklist derivation from the server-authoritative progress snapshot. */
export function publicationChecklist(
  input: ListingProgressInput,
  askingPriceAed: number | null,
): Record<PublicationChecklistItem, ChecklistStatus> {
  const s = computeReadiness(input).statuses;
  const ok = (v: string): ChecklistStatus => (v === 'COMPLETE' ? 'COMPLETE' : 'INCOMPLETE');
  return {
    details: ok(s.details),
    ownership: ok(s.verification),
    price: askingPriceAed != null && askingPriceAed > 0 ? 'COMPLETE' : 'INCOMPLETE',
    formA: ok(s.formA),
    photos: ok(s.photos),
    cover: input.photos.count > 0 && input.photos.hasCover ? 'COMPLETE' : 'INCOMPLETE',
    permit: ok(s.permit),
    privacy: 'COMPLETE', // enforced by the allowlist projection at publish time
    investmentVisibility: 'COMPLETE', // visibility is always a resolved choice
  };
}

/** A listing is eligible to be submitted for publication when every required item is COMPLETE. */
export function isPublicationEligible(
  input: ListingProgressInput,
  askingPriceAed: number | null,
): boolean {
  const c = publicationChecklist(input, askingPriceAed);
  return (Object.keys(c) as PublicationChecklistItem[]).every((k) => c[k] !== 'INCOMPLETE');
}

// --- Live-edit classification (§17.4) ---------------------------------------
/**
 * Fields that may be edited while the listing stays LIVE (update the public
 * projection after success). Everything else is MATERIAL and requires
 * Pause → edit → republish. Default-to-MATERIAL is the safe choice.
 */
export const NON_MATERIAL_FIELDS = [
  'description',
  'features',
  'photoOrder',
  'cover',
  'investmentVisibility',
] as const;
export type NonMaterialField = (typeof NON_MATERIAL_FIELDS)[number];
const NON_MATERIAL = new Set<string>(NON_MATERIAL_FIELDS);

export type EditClassification = 'NON_MATERIAL' | 'MATERIAL';
export function classifyLiveEdit(field: string): EditClassification {
  return NON_MATERIAL.has(field) ? 'NON_MATERIAL' : 'MATERIAL';
}

// --- Pause / resume (§18) ----------------------------------------------------
export function canPause(state: ListingState): boolean {
  return state === 'LIVE';
}
export function canResume(state: ListingState): boolean {
  return state === 'PAUSED';
}
/** Resuming after material changes while paused requires re-review (§18.3). */
export function resumeRequiresReview(materialChangedWhilePaused: boolean): boolean {
  return materialChangedWhilePaused;
}

// --- Public URL identity (§10.1) --------------------------------------------
const SLUG_MAX = 80;

/** Slugify a string: lowercase, ASCII-safe, hyphen-separated (latin only). */
function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Bedroom label for slug/headline: 0 → "studio", else "{n}-bedroom". */
export function bedroomLabel(bedrooms: number | null): string {
  if (bedrooms == null) return 'property';
  return bedrooms === 0 ? 'studio' : `${bedrooms}-bedroom`;
}

/**
 * Public, locale-independent slug from PUBLIC fields only (never the unit id).
 * e.g. "2-bedroom-apartment-dubai-marina". Falls back gracefully; cosmetic only
 * (lookups use the opaque public id).
 */
export function buildListingSlug(parts: {
  bedrooms: number | null;
  propertyType: string | null;
  community: string | null;
  buildingOrProject?: string | null;
}): string {
  const place = parts.community || parts.buildingOrProject || 'uae';
  const type = parts.propertyType ? parts.propertyType.toLowerCase() : 'property';
  const raw = `${bedroomLabel(parts.bedrooms)} ${type} ${place}`;
  const slug = slugify(raw).slice(0, SLUG_MAX).replace(/-+$/g, '');
  return slug || 'property';
}

/** Format an opaque public id from a random alphanumeric token (set by the API). */
export function formatPublicId(token: string): string {
  const clean = token
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 10);
  return `mkz-${clean}`;
}
