import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
  offerThreads,
  offerProposals,
  offerEvents,
  notifications,
  profiles,
  listings,
  marketplaceListings as mv,
  type Tx,
} from '@markaz/db';
import {
  expiryFromOption,
  expiryOptionSchema,
  validateOfferAmount,
  resolveAvailability,
  toSafeNotification,
  type OfferSide,
  type OfferThreadStatus,
} from '@markaz/domain';
import {
  toBuyerThread,
  toSellerThread,
  toTimeline,
  offerPropertySummary,
  type OfferPropertyInput,
  type ProposalInput,
  type ThreadInput,
  type EventInput,
} from '../offer-projection';
import { router, customerProcedure } from '../trpc';

const ACTIVE_STATUSES = ['DRAFT', 'AWAITING_SELLER', 'AWAITING_BUYER'] as const;

/**
 * Maps a raised SQL error from the offer functions to a safe TRPCError. The
 * `message` carries a STABLE machine token (e.g. 'STALE') that the UI maps to
 * localized copy; missing and forbidden both surface as a unified safe state so
 * thread existence is never disclosed (§31.1, §37.3).
 */
function mapOfferError(e: unknown): never {
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

interface ListingSummaryRow {
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
async function loadSummary(tx: Tx, listingId: string): Promise<ListingSummaryRow | null> {
  const r = await tx.execute(sql`select public.offer_listing_summary(${listingId}::uuid) as j`);
  const j = (r as unknown as Array<{ j: ListingSummaryRow | null }>)[0]?.j;
  return j ?? null;
}

function summaryToProperty(s: ListingSummaryRow): OfferPropertyInput {
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

function toThreadInput(t: typeof offerThreads.$inferSelect): ThreadInput {
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

function toProposalInput(p: typeof offerProposals.$inferSelect): ProposalInput {
  return {
    id: p.id,
    createdBySide: p.createdBySide,
    amountAed: p.amountAed,
    status: p.status,
    expiresAt: p.expiresAt,
    createdAt: p.createdAt,
  };
}

async function currentProposal(tx: Tx, id: string | null): Promise<ProposalInput | null> {
  if (!id) return null;
  const [p] = await tx.select().from(offerProposals).where(eq(offerProposals.id, id)).limit(1);
  return p ? toProposalInput(p) : null;
}

/** Resolve the caller's side on a thread, or throw the unified not-found. */
function perspectiveOf(t: typeof offerThreads.$inferSelect, userId: string): OfferSide {
  if (t.buyerUserId === userId) return 'BUYER';
  if (t.sellerUserId === userId) return 'SELLER';
  throw new TRPCError({ code: 'NOT_FOUND', message: 'NOT_FOUND' });
}

/** ISO string (or null) for the chosen expiry — the postgres driver binds strings,
 * not Date objects, into the `::timestamptz` function argument. */
function resolveExpiry(option: z.infer<typeof expiryOptionSchema>): string | null {
  const d = expiryFromOption(option, new Date());
  return d ? d.toISOString() : null;
}

const threadIdInput = z.object({ threadId: z.string().uuid() });
const versionedThread = z.object({ threadId: z.string().uuid(), expectedVersion: z.number().int().nonnegative() });
const amountInput = z.number().int().positive();

export const offersRouter = router({
  // ---- Buyer: eligibility + creation ----------------------------------------
  /** Resolve whether the current customer may make an offer on a public listing. */
  eligibility: customerProcedure
    .input(z.object({ publicId: z.string().max(40) }))
    .query(async ({ ctx, input }) => {
      const [l] = await ctx.tx
        .select({ id: listings.id, ownerId: listings.ownerId, state: listings.state })
        .from(listings)
        .where(eq(listings.publicId, input.publicId))
        .limit(1);
      if (!l || l.state !== 'LIVE') return { eligible: false as const, reason: 'UNAVAILABLE' as const };
      if (l.ownerId === ctx.user.id) return { eligible: false as const, reason: 'OWNER' as const };

      const [existing] = await ctx.tx
        .select({ id: offerThreads.id })
        .from(offerThreads)
        .where(and(eq(offerThreads.listingId, l.id), eq(offerThreads.buyerUserId, ctx.user.id), inArray(offerThreads.status, [...ACTIVE_STATUSES])))
        .limit(1);
      if (existing) return { eligible: false as const, reason: 'ACTIVE_THREAD' as const, threadId: existing.id };

      // "Under offer" is derived from an ACCEPTED thread, but that thread is private to
      // its participants — a non-participant buyer cannot see it under RLS. Use the
      // SECURITY DEFINER helper so eligibility is authoritative for everyone (§6.1),
      // matching the block that create_offer enforces at submit time.
      const acc = await ctx.tx.execute(sql`select public.listing_has_accepted_offer(${l.id}::uuid) as under_offer`);
      const underOffer = (acc as unknown as Array<{ under_offer: boolean }>)[0]?.under_offer ?? false;
      if (underOffer) return { eligible: false as const, reason: 'UNDER_OFFER' as const };

      const [me] = await ctx.tx.select({ onboarded: profiles.onboardingCompletedAt }).from(profiles).where(eq(profiles.id, ctx.user.id)).limit(1);
      if (!me?.onboarded) return { eligible: false as const, reason: 'ONBOARDING' as const };

      // Pre-thread property summary comes from the PUBLIC marketplace view — the
      // buyer is not yet a thread participant, so the participant-gated summary fn
      // would return nothing here.
      const [row] = await ctx.tx
        .select({
          publicId: mv.publicId, publicSlug: mv.publicSlug, askingPrice: mv.askingPrice,
          bedrooms: mv.bedrooms, bathrooms: mv.bathrooms, propertyType: mv.propertyType,
          community: mv.community, buildingOrProject: mv.buildingOrProject, emirate: mv.emirate,
          coverPublicPath: mv.coverPublicPath,
        })
        .from(mv)
        .where(eq(mv.publicId, input.publicId))
        .limit(1);
      const property = row ? offerPropertySummary(row) : null;
      return { eligible: true as const, reason: 'OK' as const, property };
    }),

  /** Submit the initial buyer proposal; creates the thread atomically (idempotent). */
  submitInitialProposal: customerProcedure
    .input(z.object({ publicId: z.string().max(40), amountAed: amountInput, expiry: expiryOptionSchema }))
    .mutation(async ({ ctx, input }) => {
      if (validateOfferAmount(input.amountAed)) throw new TRPCError({ code: 'BAD_REQUEST', message: 'INVALID_AMOUNT' });
      const [l] = await ctx.tx.select({ id: listings.id }).from(listings).where(eq(listings.publicId, input.publicId)).limit(1);
      if (!l) throw new TRPCError({ code: 'NOT_FOUND', message: 'NOT_FOUND' });

      // If an active thread already exists, resolve it idempotently (§15.3).
      const [existing] = await ctx.tx
        .select({ id: offerThreads.id })
        .from(offerThreads)
        .where(and(eq(offerThreads.listingId, l.id), eq(offerThreads.buyerUserId, ctx.user.id), inArray(offerThreads.status, [...ACTIVE_STATUSES])))
        .limit(1);
      if (existing) return { threadId: existing.id, created: false as const };

      const expiresAt = resolveExpiry(input.expiry);
      try {
        const r = await ctx.tx.execute(
          sql`select id::text as id from public.create_offer(${l.id}::uuid, ${input.amountAed}, ${expiresAt}::timestamptz)`,
        );
        const id = (r as unknown as Array<{ id: string }>)[0]?.id;
        return { threadId: id, created: true as const };
      } catch (e) {
        // A racing duplicate is treated as "view your existing offer".
        if ((e as { code?: string }).code === '23505') {
          const [t] = await ctx.tx
            .select({ id: offerThreads.id })
            .from(offerThreads)
            .where(and(eq(offerThreads.listingId, l.id), eq(offerThreads.buyerUserId, ctx.user.id), inArray(offerThreads.status, [...ACTIVE_STATUSES])))
            .limit(1);
          if (t) return { threadId: t.id, created: false as const };
        }
        mapOfferError(e);
      }
    }),

  // ---- Lists ----------------------------------------------------------------
  /** Threads the current customer created (buyer perspective). */
  getBuyerThreads: customerProcedure
    .input(z.object({ filter: z.enum(['all', 'action', 'waiting', 'accepted', 'closed']).default('all') }).optional())
    .query(async ({ ctx, input }) => {
      await ctx.tx.execute(sql`select public.expire_due_offers()`);
      const rows = await ctx.tx
        .select()
        .from(offerThreads)
        .where(eq(offerThreads.buyerUserId, ctx.user.id))
        .orderBy(desc(offerThreads.lastActivityAt));
      const summaries = new Map<string, ListingSummaryRow | null>();
      const out = [];
      for (const t of rows) {
        if (!matchesBuyerFilter(t.status as OfferThreadStatus, t.nextActor, input?.filter ?? 'all')) continue;
        if (!summaries.has(t.listingId)) summaries.set(t.listingId, await loadSummary(ctx.tx, t.listingId));
        const s = summaries.get(t.listingId);
        if (!s) continue;
        out.push(toBuyerThread({ thread: toThreadInput(t), current: await currentProposal(ctx.tx, t.currentProposalId), property: summaryToProperty(s) }));
      }
      return out;
    }),

  /** Threads received across the current customer's listings (seller perspective). */
  getSellerInbox: customerProcedure
    .input(z.object({ filter: z.enum(['all', 'action', 'waiting', 'accepted', 'closed', 'aboveThreshold', 'belowThreshold']).default('all') }).optional())
    .query(async ({ ctx, input }) => {
      await ctx.tx.execute(sql`select public.expire_due_offers()`);
      const rows = await ctx.tx
        .select()
        .from(offerThreads)
        .where(eq(offerThreads.sellerUserId, ctx.user.id))
        .orderBy(desc(offerThreads.lastActivityAt));
      const summaries = new Map<string, ListingSummaryRow | null>();
      const out = [];
      for (const t of rows) {
        if (!matchesSellerFilter(t.status as OfferThreadStatus, t.nextActor, input?.filter ?? 'all')) continue;
        if (!summaries.has(t.listingId)) summaries.set(t.listingId, await loadSummary(ctx.tx, t.listingId));
        const s = summaries.get(t.listingId);
        if (!s) continue;
        const cur = await currentProposal(ctx.tx, t.currentProposalId);
        const view = toSellerThread({
          thread: toThreadInput(t),
          current: cur,
          property: summaryToProperty(s),
          minNotificationPrice: s.minNotificationPrice == null ? null : Number(s.minNotificationPrice),
        });
        // Threshold-based seller filters.
        if (input?.filter === 'aboveThreshold' && view.threshold !== 'AT_OR_ABOVE') continue;
        if (input?.filter === 'belowThreshold' && view.threshold !== 'BELOW') continue;
        out.push(view);
      }
      return out;
    }),

  /** Listing-specific seller offer management view (owner-only). */
  getListingOffers: customerProcedure
    .input(z.object({ listingId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const s = await loadSummary(ctx.tx, input.listingId);
      if (!s || s.ownerId !== ctx.user.id) throw new TRPCError({ code: 'NOT_FOUND', message: 'NOT_FOUND' });
      await ctx.tx.execute(sql`select public.expire_due_offers()`);
      const rows = await ctx.tx
        .select()
        .from(offerThreads)
        .where(eq(offerThreads.listingId, input.listingId))
        .orderBy(desc(offerThreads.lastActivityAt));
      const min = s.minNotificationPrice == null ? null : Number(s.minNotificationPrice);
      const threads = [];
      let highest: number | null = null;
      let actionNeeded = 0;
      let activeCount = 0;
      for (const t of rows) {
        const cur = await currentProposal(ctx.tx, t.currentProposalId);
        const view = toSellerThread({ thread: toThreadInput(t), current: cur, property: summaryToProperty(s), minNotificationPrice: min });
        if (view.isActionable) actionNeeded += 1;
        if (t.status === 'AWAITING_SELLER' || t.status === 'AWAITING_BUYER') {
          activeCount += 1;
          if (cur) highest = Math.max(highest ?? 0, Number(cur.amountAed));
        }
        threads.push(view);
      }
      const availability = resolveAvailability({
        listingState: s.state,
        hasAcceptedOffer: rows.some((r) => r.status === 'ACCEPTED'),
      });
      return {
        listing: {
          ...offerPropertySummary(summaryToProperty(s)),
          state: s.state,
          availability,
          // Threshold is shown ONLY on the owner's own listing view (§18.1).
          notificationThresholdAed: min,
          activeCount,
          actionNeeded,
          highestProposalAed: highest,
        },
        threads,
      };
    }),

  // ---- Thread detail --------------------------------------------------------
  /** Perspective-aware thread detail + timeline (participant-only). */
  getThread: customerProcedure.input(threadIdInput).query(async ({ ctx, input }) => {
    await ctx.tx.execute(sql`select public.expire_due_offers()`);
    const [t] = await ctx.tx.select().from(offerThreads).where(eq(offerThreads.id, input.threadId)).limit(1);
    if (!t) throw new TRPCError({ code: 'NOT_FOUND', message: 'NOT_FOUND' });
    const perspective = perspectiveOf(t, ctx.user.id);
    if (perspective === 'SELLER') await ctx.tx.execute(sql`select public.mark_offer_viewed(${t.id}::uuid)`);

    const s = await loadSummary(ctx.tx, t.listingId);
    if (!s) throw new TRPCError({ code: 'NOT_FOUND', message: 'NOT_FOUND' });
    const cur = await currentProposal(ctx.tx, t.currentProposalId);
    const eventRows = await ctx.tx
      .select()
      .from(offerEvents)
      .where(eq(offerEvents.threadId, t.id))
      .orderBy(offerEvents.createdAt);
    const timeline = toTimeline(eventRows.map((e): EventInput => ({
      id: e.id,
      eventType: e.eventType,
      actorSide: e.actorSide,
      amountAed: e.amountAed,
      metadata: e.metadata,
      createdAt: e.createdAt,
    })));

    const thread =
      perspective === 'BUYER'
        ? toBuyerThread({ thread: toThreadInput(t), current: cur, property: summaryToProperty(s) })
        : toSellerThread({
            thread: toThreadInput(t),
            current: cur,
            property: summaryToProperty(s),
            minNotificationPrice: s.minNotificationPrice == null ? null : Number(s.minNotificationPrice),
          });
    return { thread, timeline };
  }),

  // ---- Mutations (server-authoritative via SQL functions) -------------------
  submitBuyerCounter: customerProcedure
    .input(versionedThread.extend({ amountAed: amountInput, expiry: expiryOptionSchema }))
    .mutation(({ ctx, input }) => runCounter(ctx, input)),

  submitSellerCounter: customerProcedure
    .input(versionedThread.extend({ amountAed: amountInput, expiry: expiryOptionSchema }))
    .mutation(({ ctx, input }) => runCounter(ctx, input)),

  acceptSellerCounter: customerProcedure
    .input(versionedThread.extend({ proposalId: z.string().uuid() }))
    .mutation(({ ctx, input }) => runAccept(ctx, input)),

  acceptBuyerProposal: customerProcedure
    .input(versionedThread.extend({ proposalId: z.string().uuid() }))
    .mutation(({ ctx, input }) => runAccept(ctx, input)),

  reject: customerProcedure
    .input(versionedThread.extend({ reasonCode: z.string().max(40).optional() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.tx.execute(
          sql`select public.reject_offer(${input.threadId}::uuid, ${input.expectedVersion}, ${input.reasonCode ?? null})`,
        );
        return { ok: true as const };
      } catch (e) {
        mapOfferError(e);
      }
    }),

  rejectSellerCounter: customerProcedure.input(versionedThread).mutation(async ({ ctx, input }) => {
    try {
      await ctx.tx.execute(sql`select public.reject_offer(${input.threadId}::uuid, ${input.expectedVersion}, ${null})`);
      return { ok: true as const };
    } catch (e) {
      mapOfferError(e);
    }
  }),

  withdraw: customerProcedure.input(versionedThread).mutation(async ({ ctx, input }) => {
    try {
      await ctx.tx.execute(sql`select public.withdraw_offer(${input.threadId}::uuid, ${input.expectedVersion})`);
      return { ok: true as const };
    } catch (e) {
      mapOfferError(e);
    }
  }),

  // ---- Notifications + badges -----------------------------------------------
  /** Action-needed badge (Offers nav) + bell unread count. */
  getUnreadCounts: customerProcedure.query(async ({ ctx }) => {
    await ctx.tx.execute(sql`select public.expire_due_offers()`);
    const [bell] = await ctx.tx
      .select({ n: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.recipientId, ctx.user.id), isNull(notifications.readAt)));
    const action = await ctx.tx
      .select({ status: offerThreads.status, nextActor: offerThreads.nextActor, buyer: offerThreads.buyerUserId, seller: offerThreads.sellerUserId })
      .from(offerThreads)
      .where(inArray(offerThreads.status, ['AWAITING_SELLER', 'AWAITING_BUYER']));
    const actionNeeded = action.filter(
      (t) =>
        (t.buyer === ctx.user.id && t.status === 'AWAITING_BUYER' && t.nextActor === 'BUYER') ||
        (t.seller === ctx.user.id && t.status === 'AWAITING_SELLER' && t.nextActor === 'SELLER'),
    ).length;
    return { unread: Number(bell?.n ?? 0), actionNeeded };
  }),

  /** Recent in-app notifications for the header bell menu (§30.3). */
  notifications: customerProcedure.input(z.object({ limit: z.number().int().min(1).max(50).default(20) }).optional()).query(async ({ ctx, input }) => {
    const rows = await ctx.tx
      .select()
      .from(notifications)
      .where(eq(notifications.recipientId, ctx.user.id))
      .orderBy(desc(notifications.createdAt))
      .limit(input?.limit ?? 20);
    return rows.map((n) => {
      // Validate {kind, payload} through the discriminated-union schema; an
      // unexpected kind or malformed payload degrades to a safe UNKNOWN/null.
      const safe = toSafeNotification(n.kind, n.payload);
      return {
        id: n.id,
        kind: safe.kind,
        threadId: safe.threadId,
        transactionId: safe.transactionId,
        listingId: safe.listingId,
        read: n.readAt != null,
        createdAt: n.createdAt.toISOString(),
      };
    });
  }),

  markNotificationRead: customerProcedure.input(z.object({ id: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    await ctx.tx
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.id, input.id), eq(notifications.recipientId, ctx.user.id)));
    return { ok: true as const };
  }),

  markAllNotificationsRead: customerProcedure.mutation(async ({ ctx }) => {
    await ctx.tx
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.recipientId, ctx.user.id), isNull(notifications.readAt)));
    return { ok: true as const };
  }),
});

// --- shared mutation runners ---------------------------------------------------
type Ctx = { tx: Tx };

async function runCounter(
  ctx: Ctx,
  input: { threadId: string; expectedVersion: number; amountAed: number; expiry: z.infer<typeof expiryOptionSchema> },
) {
  if (validateOfferAmount(input.amountAed)) throw new TRPCError({ code: 'BAD_REQUEST', message: 'INVALID_AMOUNT' });
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

async function runAccept(ctx: Ctx, input: { threadId: string; expectedVersion: number; proposalId: string }) {
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
function matchesBuyerFilter(status: OfferThreadStatus, nextActor: string, filter: string): boolean {
  switch (filter) {
    case 'action':
      return status === 'AWAITING_BUYER' && nextActor === 'BUYER';
    case 'waiting':
      return status === 'AWAITING_SELLER';
    case 'accepted':
      return status === 'ACCEPTED';
    case 'closed':
      return ['REJECTED', 'WITHDRAWN', 'EXPIRED', 'CLOSED_OTHER_ACCEPTED', 'CLOSED_LISTING_UNAVAILABLE'].includes(status);
    default:
      return true;
  }
}

function matchesSellerFilter(status: OfferThreadStatus, nextActor: string, filter: string): boolean {
  switch (filter) {
    case 'action':
      return status === 'AWAITING_SELLER' && nextActor === 'SELLER';
    case 'waiting':
      return status === 'AWAITING_BUYER';
    case 'accepted':
      return status === 'ACCEPTED';
    case 'closed':
      return ['REJECTED', 'WITHDRAWN', 'EXPIRED', 'CLOSED_OTHER_ACCEPTED', 'CLOSED_LISTING_UNAVAILABLE'].includes(status);
    default:
      return true;
  }
}
