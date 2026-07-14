import {
  offerComparison,
  classifyThreshold,
  userFacingStatusKey,
  isThreadActionable,
  buyerSeqLabel,
  type OfferThreadStatus,
  type OfferNextActor,
  type OfferSide,
  type OfferProposalStatus,
  type OfferEventType,
} from '@markaz/domain';
import { publicPhotoUrl, buildHeadline } from './public-projection';

/**
 * Offer projection (offers-design-spec §37 — privacy allow-list). Buyer and
 * seller views are built by EXPLICIT mapping; nothing private leaks. Specifically:
 *   - the buyer NEVER receives the seller threshold or any competing-offer data;
 *   - the seller NEVER receives buyer contact details, only the stable "Buyer NN"
 *     safe label + "Verified customer";
 *   - raw internal enum values are mapped to copy keys; IDs that appear are the
 *     opaque thread id (route target) only.
 */

/** Shared property summary that anchors every thread/card (public-safe fields). */
export interface OfferPropertyInput {
  publicId: string | null;
  publicSlug: string | null;
  askingPrice: string | number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  propertyType: string | null;
  community: string | null;
  buildingOrProject: string | null;
  emirate: string | null;
  coverPublicPath: string | null;
}

function numOr(v: string | number | null | undefined): number | null {
  return v === null || v === undefined ? null : Number(v);
}

export function offerPropertySummary(p: OfferPropertyInput) {
  return {
    publicId: p.publicId,
    slug: p.publicSlug,
    headline: buildHeadline({
      bedrooms: p.bedrooms,
      propertyType: p.propertyType,
      buildingOrProject: p.buildingOrProject,
      community: p.community,
    }),
    askingPriceAed: numOr(p.askingPrice),
    bedrooms: p.bedrooms,
    bathrooms: p.bathrooms,
    community: p.community,
    emirate: p.emirate,
    coverUrl: publicPhotoUrl(p.coverPublicPath),
  };
}

export interface ProposalInput {
  id: string;
  createdBySide: OfferSide;
  amountAed: string | number;
  status: OfferProposalStatus;
  expiresAt: Date | null;
  createdAt: Date;
}

export interface ThreadInput {
  id: string;
  status: OfferThreadStatus;
  nextActor: OfferNextActor;
  currentProposalId: string | null;
  acceptedProposalId: string | null;
  closedReason: string | null;
  rejectReasonCode: string | null;
  expiresAt: Date | null;
  buyerSeq: number;
  lastActivityAt: Date;
  createdAt: Date;
  version: number;
}

export interface EventInput {
  id: string;
  eventType: OfferEventType;
  actorSide: OfferSide | null;
  amountAed: string | number | null;
  metadata: unknown;
  createdAt: Date;
}

/** Map a proposal to its safe wire shape (amount is shared with both parties). */
function mapProposal(p: ProposalInput, perspective: OfferSide) {
  return {
    id: p.id,
    bySide: p.createdBySide,
    byYou: p.createdBySide === perspective,
    amountAed: Number(p.amountAed),
    status: p.status,
    expiresAt: p.expiresAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
  };
}

function mapEvent(e: EventInput) {
  return {
    id: e.id,
    type: e.eventType,
    actorSide: e.actorSide,
    amountAed: e.amountAed === null ? null : Number(e.amountAed),
    createdAt: e.createdAt.toISOString(),
  };
}

/** Common fields shared by both perspectives. */
function baseThread(
  thread: ThreadInput,
  current: ProposalInput | null,
  property: OfferPropertyInput,
  perspective: OfferSide,
) {
  const asking = numOr(property.askingPrice) ?? 0;
  const currentAmount = current ? Number(current.amountAed) : null;
  return {
    threadId: thread.id,
    version: thread.version,
    perspective,
    status: thread.status,
    statusKey: userFacingStatusKey(thread.status, perspective),
    nextActor: thread.nextActor,
    isActionable: isThreadActionable(thread.status) && thread.nextActor === perspective,
    closedReason: thread.closedReason,
    expiresAt: thread.expiresAt?.toISOString() ?? null,
    lastActivityAt: thread.lastActivityAt.toISOString(),
    createdAt: thread.createdAt.toISOString(),
    property: offerPropertySummary(property),
    currentProposal: current ? mapProposal(current, perspective) : null,
    comparison:
      currentAmount != null && asking > 0 ? offerComparison(currentAmount, asking) : null,
  };
}

/**
 * BUYER view of a thread. Excludes the seller threshold, the seller-private
 * rejection reason, and any competing-offer information (§16.2, §37.1).
 */
export function toBuyerThread(args: {
  thread: ThreadInput;
  current: ProposalInput | null;
  property: OfferPropertyInput;
}) {
  return { ...baseThread(args.thread, args.current, args.property, 'BUYER'), perspective: 'BUYER' as const };
}

/**
 * SELLER view of a thread. Adds the buyer-safe label + threshold classification
 * (seller-only); never the buyer's identity or contact details (§17.4, §27).
 */
export function toSellerThread(args: {
  thread: ThreadInput;
  current: ProposalInput | null;
  property: OfferPropertyInput;
  minNotificationPrice: number | null;
}) {
  const base = baseThread(args.thread, args.current, args.property, 'SELLER');
  const amount = args.current ? Number(args.current.amountAed) : null;
  return {
    ...base,
    perspective: 'SELLER' as const,
    buyerLabel: buyerSeqLabel(args.thread.buyerSeq),
    threshold: amount != null ? classifyThreshold(amount, args.minNotificationPrice) : null,
  };
}

/** Map an ordered event list to the shared timeline shape. */
export function toTimeline(events: EventInput[]) {
  return events.map(mapEvent);
}

export type BuyerThread = ReturnType<typeof toBuyerThread>;
export type SellerThread = ReturnType<typeof toSellerThread>;
