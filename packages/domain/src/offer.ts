import { z } from 'zod';

/**
 * Week 4 offer domain (offers-design-spec §4–6). One negotiation thread per
 * (buyer, listing) holding an immutable chronological sequence of proposals with
 * an explicit next-action owner. These are PURE helpers: server-authoritative
 * enforcement lives in the SQL SECURITY DEFINER functions (migration 08.4); this
 * module is shared by the API, the public projection, and the UI, and is the
 * single source of the user-facing copy mapping.
 *
 * The Week-1 flat single-offer model (OFFER_STATES/canTransitionOffer) was
 * retired with the old `offers` table — see ADR-0014.
 */

// --- Thread + proposal enums -------------------------------------------------
export const OFFER_THREAD_STATUSES = [
  'DRAFT',
  'AWAITING_SELLER',
  'AWAITING_BUYER',
  'ACCEPTED',
  'REJECTED',
  'WITHDRAWN',
  'EXPIRED',
  'CLOSED_OTHER_ACCEPTED',
  'CLOSED_LISTING_UNAVAILABLE',
] as const;
export type OfferThreadStatus = (typeof OFFER_THREAD_STATUSES)[number];
export const offerThreadStatusSchema = z.enum(OFFER_THREAD_STATUSES);

export const OFFER_NEXT_ACTORS = ['BUYER', 'SELLER', 'NONE'] as const;
export type OfferNextActor = (typeof OFFER_NEXT_ACTORS)[number];

export const OFFER_PROPOSAL_STATUSES = [
  'CURRENT',
  'SUPERSEDED',
  'ACCEPTED',
  'REJECTED',
  'EXPIRED',
  'WITHDRAWN',
  'CLOSED',
] as const;
export type OfferProposalStatus = (typeof OFFER_PROPOSAL_STATUSES)[number];

export const OFFER_SIDES = ['BUYER', 'SELLER'] as const;
export type OfferSide = (typeof OFFER_SIDES)[number];

export const OFFER_EVENT_TYPES = [
  'OFFER_SUBMITTED',
  'SELLER_COUNTERED',
  'BUYER_COUNTERED',
  'OFFER_ACCEPTED',
  'OFFER_REJECTED',
  'OFFER_WITHDRAWN',
  'OFFER_EXPIRED',
  'OFFER_VIEWED',
  'LISTING_PAUSED',
  'LISTING_UNAVAILABLE',
  'OTHER_OFFER_ACCEPTED',
] as const;
export type OfferEventType = (typeof OFFER_EVENT_TYPES)[number];

/** Derived listing availability (§6.1) — NOT a listing publication state. */
export const OFFER_AVAILABILITIES = ['AVAILABLE', 'UNDER_OFFER', 'OFFERS_DISABLED'] as const;
export type OfferAvailability = (typeof OFFER_AVAILABILITIES)[number];

/** Predefined, seller-private rejection reasons (§23.1). */
export const REJECT_REASON_CODES = [
  'AMOUNT_TOO_LOW',
  'NO_LONGER_AVAILABLE',
  'SELECTED_ANOTHER',
  'TERMS_NOT_SUITABLE',
  'OTHER',
] as const;
export type RejectReasonCode = (typeof REJECT_REASON_CODES)[number];
export const rejectReasonSchema = z.enum(REJECT_REASON_CODES);

// --- Money + expiry ----------------------------------------------------------
/** Whole-dirham ceiling (§13.4 / §14.1). */
export const MAX_OFFER_AED = 999_999_999;

/** Non-blocking warning threshold: more than 20% from asking (§13.6). */
export const SIGNIFICANT_DELTA_PCT = 20;

export const EXPIRY_OPTIONS = ['48h', '3d', '7d', 'none'] as const;
export type ExpiryOption = (typeof EXPIRY_OPTIONS)[number];
export const expiryOptionSchema = z.enum(EXPIRY_OPTIONS);
export const DEFAULT_EXPIRY_OPTION: ExpiryOption = '7d';

const EXPIRY_HOURS: Record<Exclude<ExpiryOption, 'none'>, number> = {
  '48h': 48,
  '3d': 72,
  '7d': 168,
};

/** Server-authoritative expiry instant for a chosen option (§25). */
export function expiryFromOption(option: ExpiryOption, now: Date): Date | null {
  if (option === 'none') return null;
  return new Date(now.getTime() + EXPIRY_HOURS[option] * 60 * 60 * 1000);
}

export function isProposalExpired(expiresAt: Date | null | undefined, now: Date): boolean {
  if (!expiresAt) return false;
  return expiresAt.getTime() <= now.getTime();
}

/**
 * Normalise a raw amount string to whole dirhams. Accepts Western and
 * Arabic-Indic digits and grouping separators; rejects decimals/scientific
 * notation/negatives (§13.4). Returns null when not a clean positive integer.
 */
export function normalizeAmountInput(raw: string): number | null {
  if (typeof raw !== 'string') return null;
  // Map Arabic-Indic (٠-٩) and Eastern Arabic-Indic (۰-۹) digits to ASCII.
  const ascii = raw.replace(/[٠-٩۰-۹]/g, (d) => {
    const code = d.charCodeAt(0);
    const base = code >= 0x06f0 ? 0x06f0 : 0x0660;
    return String(code - base);
  });
  const stripped = ascii.replace(/[\s,]/g, '').trim();
  if (stripped === '') return null;
  if (!/^\d+$/.test(stripped)) return null; // no sign, decimal, or letters
  const n = Number(stripped);
  return Number.isSafeInteger(n) ? n : null;
}

export type AmountError = 'REQUIRED' | 'POSITIVE' | 'INTEGER' | 'MAX';

/** Validate a numeric AED amount (server + client share this). */
export function validateOfferAmount(amount: number | null | undefined): AmountError | null {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return 'REQUIRED';
  if (!Number.isInteger(amount)) return 'INTEGER';
  if (amount <= 0) return 'POSITIVE';
  if (amount > MAX_OFFER_AED) return 'MAX';
  return null;
}

// --- Comparison + threshold --------------------------------------------------
export interface OfferComparison {
  absDiff: number;
  pct: number; // one-decimal percentage of asking
  direction: 'BELOW' | 'ABOVE' | 'EQUAL';
}

/** Difference from asking price (§13.5). Server-computed; never trust client. */
export function offerComparison(amount: number, askingPrice: number): OfferComparison {
  const absDiff = Math.abs(amount - askingPrice);
  const pct = askingPrice > 0 ? Math.round((absDiff / askingPrice) * 1000) / 10 : 0;
  const direction = amount === askingPrice ? 'EQUAL' : amount < askingPrice ? 'BELOW' : 'ABOVE';
  return { absDiff, pct, direction };
}

/** Non-blocking low/high warning (§13.6) — never reveals the seller threshold. */
export function offerWarning(amount: number, askingPrice: number): 'LOW' | 'HIGH' | null {
  if (askingPrice <= 0) return null;
  const deltaPct = ((amount - askingPrice) / askingPrice) * 100;
  if (deltaPct < -SIGNIFICANT_DELTA_PCT) return 'LOW';
  if (deltaPct > SIGNIFICANT_DELTA_PCT) return 'HIGH';
  return null;
}

export type ThresholdClass = 'AT_OR_ABOVE' | 'BELOW';

/** Seller-only threshold classification (§27). Never sent to the buyer. */
export function classifyThreshold(
  amount: number,
  minNotificationPrice: number | null | undefined,
): ThresholdClass {
  if (minNotificationPrice == null) return 'AT_OR_ABOVE';
  return amount < minNotificationPrice ? 'BELOW' : 'AT_OR_ABOVE';
}

/** Threshold rule kept from Week 1 (an offer below min triggers no notification). */
export function isBelowThreshold(amount: number, minNotificationPrice: number | null): boolean {
  return classifyThreshold(amount, minNotificationPrice) === 'BELOW';
}

// --- Availability + thread logic ---------------------------------------------
/** Derive offer availability from listing state + accepted-offer presence (§6.1). */
export function resolveAvailability(params: {
  listingState: string;
  hasAcceptedOffer: boolean;
}): OfferAvailability {
  if (params.listingState !== 'LIVE') return 'OFFERS_DISABLED';
  if (params.hasAcceptedOffer) return 'UNDER_OFFER';
  return 'AVAILABLE';
}

export function isThreadActionable(status: OfferThreadStatus): boolean {
  return status === 'AWAITING_SELLER' || status === 'AWAITING_BUYER';
}

export function isThreadClosed(status: OfferThreadStatus): boolean {
  return (
    status === 'ACCEPTED' ||
    status === 'REJECTED' ||
    status === 'WITHDRAWN' ||
    status === 'EXPIRED' ||
    status === 'CLOSED_OTHER_ACCEPTED' ||
    status === 'CLOSED_LISTING_UNAVAILABLE'
  );
}

/** The side whose turn it is, given the thread next_actor. */
export function actorSide(nextActor: OfferNextActor): OfferSide | null {
  if (nextActor === 'BUYER') return 'BUYER';
  if (nextActor === 'SELLER') return 'SELLER';
  return null;
}

/** Thread status + next_actor after a side submits a counter (§21.3). */
export function afterCounter(side: OfferSide): {
  status: OfferThreadStatus;
  nextActor: OfferNextActor;
} {
  return side === 'BUYER'
    ? { status: 'AWAITING_SELLER', nextActor: 'SELLER' }
    : { status: 'AWAITING_BUYER', nextActor: 'BUYER' };
}

/** Is it `side`'s turn to act on this thread? */
export function canAct(
  status: OfferThreadStatus,
  nextActor: OfferNextActor,
  side: OfferSide,
): boolean {
  return isThreadActionable(status) && nextActor === side;
}

/** A buyer may withdraw any active thread before acceptance (§24.1). */
export function canWithdraw(status: OfferThreadStatus, side: OfferSide): boolean {
  return side === 'BUYER' && isThreadActionable(status);
}

/**
 * Hard product rule (§3): a customer can NEVER offer on a listing they own.
 * Enforced in SQL + RLS; surfaced in the UI; covered by tests.
 */
export function canSubmitOffer(params: {
  offeringUserId: string;
  listingOwnerId: string;
}): boolean {
  return params.offeringUserId !== params.listingOwnerId;
}

/** Counter must differ from the current proposal; equal → Accept instead (§21.4). */
export function isEqualCounter(amount: number, currentAmount: number): boolean {
  return amount === currentAmount;
}

// --- User-facing status mapping (§5.3) ---------------------------------------
/**
 * Maps an internal thread status + the viewer's perspective to a stable i18n key
 * suffix under `offer.status.*`. Raw internal enum values are NEVER shown (§3.17).
 */
export function userFacingStatusKey(status: OfferThreadStatus, perspective: OfferSide): string {
  switch (status) {
    case 'DRAFT':
      return 'draft';
    case 'AWAITING_SELLER':
      return perspective === 'BUYER' ? 'waitingSeller' : 'responseNeeded';
    case 'AWAITING_BUYER':
      return perspective === 'BUYER' ? 'responseNeeded' : 'waitingBuyer';
    case 'ACCEPTED':
      return 'accepted';
    case 'REJECTED':
      return 'rejected';
    case 'WITHDRAWN':
      return 'withdrawn';
    case 'EXPIRED':
      return 'expired';
    case 'CLOSED_OTHER_ACCEPTED':
      return perspective === 'BUYER' ? 'otherAccepted' : 'otherAccepted';
    case 'CLOSED_LISTING_UNAVAILABLE':
      return 'unavailable';
    default:
      return 'unavailable';
  }
}

/** Stable per-listing buyer label sequence, e.g. 1 → "01" (§17.4). */
export function buyerSeqLabel(seq: number): string {
  return String(Math.max(1, Math.trunc(seq))).padStart(2, '0');
}
