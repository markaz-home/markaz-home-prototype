import { eq, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { offerProposals, type offerThreads, type Tx } from '@markaz/db';
import {
  expiryFromOption,
  validateOfferAmount,
  type expiryOptionSchema,
  type OfferSide,
  type OfferThreadStatus,
} from '@markaz/domain';
import type { OfferPropertyInput, ProposalInput, ThreadInput } from '../../offer-projection';

export const ACTIVE_STATUSES = ['DRAFT', 'AWAITING_SELLER', 'AWAITING_BUYER'] as const;

/**
 * Maps a raised SQL error from the offer functions to a safe TRPCError. The
 * `message` carries a STABLE machine token (e.g. 'STALE') that the UI maps to
 * localized copy; missing and forbidden both surface as a unified safe state so
 * thread existence is never disclosed (§31.1, §37.3).
 */
export function mapOfferError(e: unknown): never {
  const err = e as { message?: string; code?: string };
  const raw = err?.message ?? '';
  const token = raw.replace(/^.*?(\b[A-Z_]{3,}\b).*$/s, '$1');
  if (err?.code === '23505') {
    // Active-thread / single-accepted unique violation.
    throw new TRPCError({ code: 'CONFLICT', message: 'STALE' });
  }
  const m = (code: TRPCError['code'], t: string): never => {
    throw new TRPCError({ code, message: t });
  };
  switch (token) {
    case 'NOT_FOUND':
    case 'LISTING_NOT_FOUND':
      return m('NOT_FOUND', 'NOT_FOUND');
    case 'OWN_LISTING':
      return m('BAD_REQUEST', 'OWN_LISTING');
    case 'UNDER_OFFER':
    case 'ALREADY_ACCEPTED':
      return m('CONFLICT', 'ALREADY_ACCEPTED');
    case 'LISTING_UNAVAILABLE':
      return m('BAD_REQUEST', 'LISTING_UNAVAILABLE');
    case 'LISTING_CHANGED':
      return m('CONFLICT', 'LISTING_CHANGED');
    case 'STALE':
    case 'NOT_YOUR_TURN':
    case 'NOT_ACTIONABLE':
      return m('CONFLICT', 'STALE');
    case 'EXPIRED':
      return m('BAD_REQUEST', 'EXPIRED');
    case 'EQUAL_AMOUNT':
      return m('BAD_REQUEST', 'EQUAL_AMOUNT');
    case 'INVALID_AMOUNT':
      return m('BAD_REQUEST', 'INVALID_AMOUNT');
    case 'AUTH_REQUIRED':
      return m('UNAUTHORIZED', 'AUTH_REQUIRED');
    default:
      return m('INTERNAL_SERVER_ERROR', 'GENERIC');
  }
}

export interface ListingSummaryRow {
  listingId: string;
  ownerId: string;
  state: string;
  version: number;
  publicationVersion: number;
  publicId: string | null;
  publicSlug: string | null;
  askingPrice: string | null;
  minNotificationPrice: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  propertyType: string | null;
  community: string | null;
  buildingOrProject: string | null;
  emirate: string | null;
  coverPublicPath: string | null;
}

/** Public-safe property summary for a participant/owner via the SECURITY DEFINER helper. */
export async function loadSummary(tx: Tx, listingId: string): Promise<ListingSummaryRow | null> {
  const r = await tx.execute(sql`select public.offer_listing_summary(${listingId}::uuid) as j`);
  const j = (r as unknown as Array<{ j: ListingSummaryRow | null }>)[0]?.j;
  return j ?? null;
}

export function summaryToProperty(s: ListingSummaryRow): OfferPropertyInput {
  return {
    publicId: s.publicId,
    publicSlug: s.publicSlug,
    askingPrice: s.askingPrice,
    bedrooms: s.bedrooms,
    bathrooms: s.bathrooms,
    propertyType: s.propertyType,
    community: s.community,
    buildingOrProject: s.buildingOrProject,
    emirate: s.emirate,
    coverPublicPath: s.coverPublicPath,
  };
}

export function toThreadInput(t: typeof offerThreads.$inferSelect): ThreadInput {
  return {
    id: t.id,
    status: t.status as OfferThreadStatus,
    nextActor: t.nextActor,
    currentProposalId: t.currentProposalId,
    acceptedProposalId: t.acceptedProposalId,
    closedReason: t.closedReason,
    rejectReasonCode: t.rejectReasonCode,
    expiresAt: t.expiresAt,
    buyerSeq: t.buyerSeq,
    lastActivityAt: t.lastActivityAt,
    createdAt: t.createdAt,
    version: t.version,
  };
}

export function toProposalInput(p: typeof offerProposals.$inferSelect): ProposalInput {
  return {
    id: p.id,
    createdBySide: p.createdBySide,
    amountAed: p.amountAed,
    status: p.status,
    expiresAt: p.expiresAt,
    createdAt: p.createdAt,
  };
}

export async function currentProposal(tx: Tx, id: string | null): Promise<ProposalInput | null> {
  if (!id) return null;
  const [p] = await tx.select().from(offerProposals).where(eq(offerProposals.id, id)).limit(1);
  return p ? toProposalInput(p) : null;
}

/** Resolve the caller's side on a thread, or throw the unified not-found. */
export function perspectiveOf(t: typeof offerThreads.$inferSelect, userId: string): OfferSide {
  if (t.buyerUserId === userId) return 'BUYER';
  if (t.sellerUserId === userId) return 'SELLER';
  throw new TRPCError({ code: 'NOT_FOUND', message: 'NOT_FOUND' });
}

/** ISO string (or null) for the chosen expiry — the postgres driver binds strings,
 * not Date objects, into the `::timestamptz` function argument. */
export function resolveExpiry(option: z.infer<typeof expiryOptionSchema>): string | null {
  const d = expiryFromOption(option, new Date());
  return d ? d.toISOString() : null;
}

export const threadIdInput = z.object({ threadId: z.string().uuid() });
export const versionedThread = z.object({
  threadId: z.string().uuid(),
  expectedVersion: z.number().int().nonnegative(),
});
export const amountInput = z.number().int().positive();

// --- shared mutation runners ---------------------------------------------------
type Ctx = { tx: Tx };

export async function runCounter(
  ctx: Ctx,
  input: {
    threadId: string;
    expectedVersion: number;
    amountAed: number;
    expiry: z.infer<typeof expiryOptionSchema>;
  },
) {
  if (validateOfferAmount(input.amountAed))
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'INVALID_AMOUNT' });
  const expiresAt = resolveExpiry(input.expiry);
  try {
    await ctx.tx.execute(
      sql`select public.submit_counter(${input.threadId}::uuid, ${input.amountAed}, ${expiresAt}::timestamptz, ${input.expectedVersion})`,
    );
    return { ok: true as const };
  } catch (e) {
    mapOfferError(e);
  }
}

export async function runAccept(
  ctx: Ctx,
  input: { threadId: string; expectedVersion: number; proposalId: string },
) {
  try {
    await ctx.tx.execute(
      sql`select public.accept_offer(${input.threadId}::uuid, ${input.proposalId}::uuid, ${input.expectedVersion})`,
    );
    return { ok: true as const };
  } catch (e) {
    mapOfferError(e);
  }
}

// --- filter helpers ------------------------------------------------------------
export function matchesBuyerFilter(
  status: OfferThreadStatus,
  nextActor: string,
  filter: string,
): boolean {
  switch (filter) {
    case 'action':
      return status === 'AWAITING_BUYER' && nextActor === 'BUYER';
    case 'waiting':
      return status === 'AWAITING_SELLER';
    case 'accepted':
      return status === 'ACCEPTED';
    case 'closed':
      return [
        'REJECTED',
        'WITHDRAWN',
        'EXPIRED',
        'CLOSED_OTHER_ACCEPTED',
        'CLOSED_LISTING_UNAVAILABLE',
      ].includes(status);
    default:
      return true;
  }
}

export function matchesSellerFilter(
  status: OfferThreadStatus,
  nextActor: string,
  filter: string,
): boolean {
  switch (filter) {
    case 'action':
      return status === 'AWAITING_SELLER' && nextActor === 'SELLER';
    case 'waiting':
      return status === 'AWAITING_BUYER';
    case 'accepted':
      return status === 'ACCEPTED';
    case 'closed':
      return [
        'REJECTED',
        'WITHDRAWN',
        'EXPIRED',
        'CLOSED_OTHER_ACCEPTED',
        'CLOSED_LISTING_UNAVAILABLE',
      ].includes(status);
    default:
      return true;
  }
}
