import { and, desc, eq, ilike, inArray, or, sql, count, notInArray } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
  profiles,
  listings,
  properties,
  offerThreads,
  offerProposals,
  transactions,
  transactionDocuments,
  listingPublicationRequests,
  verifications,
  adminNotes,
  auditEvents,
  type Tx,
} from '@markaz/db';
import { adminPrivateSignedUrl } from '@markaz/db/storage-admin';
import {
  adminNoteCategorySchema,
  restrictReasonSchema,
  restoreReasonSchema,
  listingPauseReasonSchema,
  returnForChangesReasonSchema,
  offerCloseReasonSchema,
  transactionFailReasonSchema,
  documentAccessReasonSchema,
  cancellationResolutionSchema,
} from '@markaz/domain';
import { router, adminProcedure, adminCapabilityProcedure } from '../trpc';
import { PublicationReviewService } from '../services/publication';
import {
  toAdminCustomerListItem,
  toAdminCustomerDetail,
  toAuditEvent,
  toAdminNote,
  toAdminDocumentMetadata,
  type AdminCustomerRow,
  type AuditRow,
  type AdminNoteRow,
} from '../admin-projection';

const page = z.object({ limit: z.number().int().min(1).max(100).default(25), offset: z.number().int().min(0).default(0) });
const idInput = z.object({ id: z.string().uuid() });

function mapAdminError(e: unknown): never {
  const msg = e instanceof Error ? e.message : String(e);
  const has = (t: string) => msg.includes(t);
  if (has('FORBIDDEN') || has('permission denied') || has('CAPABILITY')) throw new TRPCError({ code: 'FORBIDDEN', message: 'PERMISSION' });
  if (has('NOT_FOUND')) throw new TRPCError({ code: 'NOT_FOUND', message: 'NOT_FOUND' });
  for (const t of ['ALREADY_RESTRICTED', 'NOT_RESTRICTED', 'NOT_LIVE', 'NOT_PAUSED', 'NOT_ELIGIBLE', 'NOT_ACTIONABLE', 'TERMINAL', 'ALREADY_PAUSED', 'NOT_RETRYABLE', 'INVALID_TASK', 'INVALID_ACTION', 'INVALID_BODY', 'STALE'])
    if (has(t)) throw new TRPCError({ code: 'BAD_REQUEST', message: t });
  throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'ADMIN_ERROR' });
}

// ---------------------------------------------------------------------------
const overviewRouter = router({
  metrics: adminCapabilityProcedure('VIEW_OVERVIEW').query(async ({ ctx }) => {
    const one = async (q: Promise<{ n: number }[]>) => Number((await q)[0]?.n ?? 0);
    const [activeCustomers, restrictedCustomers, liveListings, pausedListings, soldListings, activeThreads, acceptedOffers, activeTx, failedTx, completedTx, pubPending, pubFailed] =
      await Promise.all([
        one(ctx.tx.select({ n: count() }).from(profiles).where(and(eq(profiles.accountType, 'CUSTOMER'), sql`${profiles.restrictedAt} is null`))),
        one(ctx.tx.select({ n: count() }).from(profiles).where(and(eq(profiles.accountType, 'CUSTOMER'), sql`${profiles.restrictedAt} is not null`))),
        one(ctx.tx.select({ n: count() }).from(listings).where(eq(listings.state, 'LIVE'))),
        one(ctx.tx.select({ n: count() }).from(listings).where(eq(listings.state, 'PAUSED'))),
        one(ctx.tx.select({ n: count() }).from(listings).where(eq(listings.state, 'SOLD_DEMO'))),
        one(ctx.tx.select({ n: count() }).from(offerThreads).where(inArray(offerThreads.status, ['AWAITING_SELLER', 'AWAITING_BUYER']))),
        one(ctx.tx.select({ n: count() }).from(offerThreads).where(eq(offerThreads.status, 'ACCEPTED'))),
        one(ctx.tx.select({ n: count() }).from(transactions).where(notInArray(transactions.status, ['COMPLETED_DEMO', 'CANCELLED', 'FAILED']))),
        one(ctx.tx.select({ n: count() }).from(transactions).where(eq(transactions.status, 'FAILED'))),
        one(ctx.tx.select({ n: count() }).from(transactions).where(eq(transactions.status, 'COMPLETED_DEMO'))),
        one(ctx.tx.select({ n: count() }).from(listingPublicationRequests).where(eq(listingPublicationRequests.status, 'PENDING'))),
        one(ctx.tx.select({ n: count() }).from(listingPublicationRequests).where(eq(listingPublicationRequests.status, 'REJECTED_DEMO'))),
      ]);
    return { activeCustomers, restrictedCustomers, liveListings, pausedListings, soldListings, activeThreads, acceptedOffers, activeTransactions: activeTx, failedTransactions: failedTx, completedTransactions: completedTx, publicationPending: pubPending, publicationFailed: pubFailed };
  }),
});

// ---------------------------------------------------------------------------
async function customerCounts(tx: Tx, id: string) {
  const [l, o, t] = await Promise.all([
    tx.select({ n: count() }).from(listings).where(eq(listings.ownerId, id)),
    tx.select({ n: count() }).from(offerThreads).where(and(or(eq(offerThreads.buyerUserId, id), eq(offerThreads.sellerUserId, id)), inArray(offerThreads.status, ['AWAITING_SELLER', 'AWAITING_BUYER']))),
    tx.select({ n: count() }).from(transactions).where(and(or(eq(transactions.buyerUserId, id), eq(transactions.sellerUserId, id)), notInArray(transactions.status, ['COMPLETED_DEMO', 'CANCELLED', 'FAILED']))),
  ]);
  return { listingCount: Number(l[0]?.n ?? 0), activeOfferCount: Number(o[0]?.n ?? 0), activeTransactionCount: Number(t[0]?.n ?? 0) };
}

const customersRouter = router({
  list: adminCapabilityProcedure('VIEW_CUSTOMERS')
    .input(page.extend({ query: z.string().max(120).optional(), filter: z.enum(['all', 'active', 'restricted', 'onboarding']).default('all') }))
    .query(async ({ ctx, input }) => {
      const conds = [eq(profiles.accountType, 'CUSTOMER')];
      if (input.query) conds.push(or(ilike(profiles.fullName, `%${input.query}%`), ilike(profiles.email, `%${input.query}%`))!);
      if (input.filter === 'restricted') conds.push(sql`${profiles.restrictedAt} is not null`);
      if (input.filter === 'active') conds.push(sql`${profiles.restrictedAt} is null`);
      if (input.filter === 'onboarding') conds.push(sql`${profiles.onboardingCompletedAt} is null`);
      const rows = await ctx.tx.select().from(profiles).where(and(...conds)).orderBy(desc(profiles.updatedAt)).limit(input.limit).offset(input.offset);
      const out = [];
      for (const r of rows) {
        const c = await customerCounts(ctx.tx, r.id);
        out.push(toAdminCustomerListItem({ id: r.id, fullName: r.fullName, email: r.email, restricted: r.restrictedAt != null, onboarded: r.onboardingCompletedAt != null, identityStatus: r.identityVerificationStatus, createdAt: r.createdAt, updatedAt: r.updatedAt, ...c } as AdminCustomerRow));
      }
      return out;
    }),
  get: adminCapabilityProcedure('VIEW_CUSTOMERS').input(idInput).query(async ({ ctx, input }) => {
    const [r] = await ctx.tx.select().from(profiles).where(and(eq(profiles.id, input.id), eq(profiles.accountType, 'CUSTOMER'))).limit(1);
    if (!r) throw new TRPCError({ code: 'NOT_FOUND', message: 'NOT_AVAILABLE' });
    const c = await customerCounts(ctx.tx, r.id);
    return toAdminCustomerDetail({ id: r.id, fullName: r.fullName, email: r.email, restricted: r.restrictedAt != null, onboarded: r.onboardingCompletedAt != null, identityStatus: r.identityVerificationStatus, createdAt: r.createdAt, updatedAt: r.updatedAt, restrictionReason: r.restrictionReason, restrictedAt: r.restrictedAt, ...c });
  }),
  restrict: adminCapabilityProcedure('MANAGE_CUSTOMER_STATUS')
    .input(z.object({ customerId: z.string().uuid(), reason: restrictReasonSchema }))
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.tx.execute(sql`select public.admin_restrict_customer(${input.customerId}::uuid, ${input.reason})`);
        return { ok: true as const };
      } catch (e) {
        mapAdminError(e);
      }
    }),
  restore: adminCapabilityProcedure('MANAGE_CUSTOMER_STATUS')
    .input(z.object({ customerId: z.string().uuid(), reason: restoreReasonSchema }))
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.tx.execute(sql`select public.admin_restore_customer(${input.customerId}::uuid, ${input.reason})`);
        return { ok: true as const };
      } catch (e) {
        mapAdminError(e);
      }
    }),
});

// ---------------------------------------------------------------------------
const notesRouter = router({
  list: adminProcedure.input(z.object({ entityType: z.string().max(40), entityId: z.string().uuid() })).query(async ({ ctx, input }) => {
    const rows = await ctx.tx.select().from(adminNotes).where(and(eq(adminNotes.entityType, input.entityType), eq(adminNotes.entityId, input.entityId), sql`${adminNotes.hiddenAt} is null`)).orderBy(desc(adminNotes.createdAt));
    return rows.map((r) => toAdminNote(r as unknown as AdminNoteRow));
  }),
  add: adminCapabilityProcedure('ADD_ADMIN_NOTES')
    .input(z.object({ entityType: z.string().max(40), entityId: z.string().uuid(), category: adminNoteCategorySchema, body: z.string().trim().min(3).max(1000), followUpDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), supersedesNoteId: z.string().uuid().optional() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.tx.execute(sql`select id from public.admin_add_note(${input.entityType}, ${input.entityId}::uuid, ${input.category}, ${input.body}, ${input.followUpDate ?? null}::date, ${input.supersedesNoteId ?? null}::uuid)`);
        return { ok: true as const };
      } catch (e) {
        mapAdminError(e);
      }
    }),
});

// ---------------------------------------------------------------------------
const listingsRouter = router({
  list: adminCapabilityProcedure('VIEW_LISTINGS')
    .input(page.extend({ state: z.string().optional(), query: z.string().max(120).optional() }))
    .query(async ({ ctx, input }) => {
      const conds = [];
      if (input.state) conds.push(eq(listings.state, input.state as 'LIVE'));
      if (input.query) conds.push(or(ilike(listings.publicId, `%${input.query}%`), ilike(listings.title, `%${input.query}%`))!);
      const rows = await ctx.tx.select({ id: listings.id, title: listings.title, state: listings.state, ownerId: listings.ownerId, publicId: listings.publicId, community: properties.community, emirate: properties.emirate, updatedAt: listings.updatedAt })
        .from(listings).leftJoin(properties, eq(properties.id, listings.propertyId))
        .where(conds.length ? and(...conds) : undefined).orderBy(desc(listings.updatedAt)).limit(input.limit).offset(input.offset);
      return rows.map((r) => ({ id: r.id, publicId: r.publicId, title: r.title, state: r.state, community: r.community, emirate: r.emirate, updatedAt: r.updatedAt.toISOString() }));
    }),
  get: adminCapabilityProcedure('VIEW_LISTINGS').input(idInput).query(async ({ ctx, input }) => {
    const [l] = await ctx.tx.select().from(listings).where(eq(listings.id, input.id)).limit(1);
    if (!l) throw new TRPCError({ code: 'NOT_FOUND', message: 'NOT_AVAILABLE' });
    const [p] = l.propertyId ? await ctx.tx.select().from(properties).where(eq(properties.id, l.propertyId)).limit(1) : [undefined];
    const [req] = await ctx.tx.select().from(listingPublicationRequests).where(and(eq(listingPublicationRequests.listingId, l.id), sql`${listingPublicationRequests.supersededAt} is null`)).limit(1);
    return {
      id: l.id,
      publicId: l.publicId,
      title: l.title,
      state: l.state,
      askingPriceAed: l.askingPrice ? Number(l.askingPrice) : null,
      ownerId: l.ownerId,
      // Public vs private labelled sections (spec §18.2).
      public: p ? { propertyType: p.propertyType, community: p.community, emirate: p.emirate, buildingOrProject: p.buildingOrProject, bedrooms: p.bedrooms, bathrooms: p.bathrooms } : null,
      private: p ? { unitIdentifier: p.unitIdentifier, occupancyStatus: p.occupancyStatus } : null,
      publication: req ? { status: req.status, outcomeCategory: req.outcomeCategory, submittedAt: req.submittedAt?.toISOString() ?? null } : null,
      pausedAt: l.pausedAt?.toISOString() ?? null,
      updatedAt: l.updatedAt.toISOString(),
    };
  }),
  pause: adminCapabilityProcedure('MANAGE_LISTING_AVAILABILITY').input(z.object({ listingId: z.string().uuid(), reason: listingPauseReasonSchema })).mutation(async ({ ctx, input }) => {
    try {
      await ctx.tx.execute(sql`select id from public.admin_pause_listing(${input.listingId}::uuid, ${input.reason})`);
      return { ok: true as const };
    } catch (e) {
      mapAdminError(e);
    }
  }),
  resume: adminCapabilityProcedure('MANAGE_LISTING_AVAILABILITY').input(z.object({ listingId: z.string().uuid(), reason: z.string().max(60) })).mutation(async ({ ctx, input }) => {
    try {
      await ctx.tx.execute(sql`select id from public.admin_resume_listing(${input.listingId}::uuid, ${input.reason})`);
      return { ok: true as const };
    } catch (e) {
      mapAdminError(e);
    }
  }),
});

// ---------------------------------------------------------------------------
const publicationRouter = router({
  queue: adminCapabilityProcedure('REVIEW_PUBLICATION').input(page.extend({ filter: z.enum(['pending', 'returned', 'all']).default('pending') })).query(async ({ ctx, input }) => {
    const statusFilter = input.filter === 'pending' ? ['PENDING'] : input.filter === 'returned' ? ['REJECTED_DEMO'] : ['PENDING', 'REJECTED_DEMO', 'APPROVED_DEMO'];
    const rows = await ctx.tx.select({ id: listingPublicationRequests.id, listingId: listingPublicationRequests.listingId, status: listingPublicationRequests.status, outcome: listingPublicationRequests.outcomeCategory, submittedAt: listingPublicationRequests.submittedAt, title: listings.title, publicId: listings.publicId, state: listings.state })
      .from(listingPublicationRequests).leftJoin(listings, eq(listings.id, listingPublicationRequests.listingId))
      .where(and(inArray(listingPublicationRequests.status, statusFilter as 'PENDING'[]), sql`${listingPublicationRequests.supersededAt} is null`))
      .orderBy(desc(listingPublicationRequests.submittedAt)).limit(input.limit).offset(input.offset);
    return rows.map((r) => ({ id: r.id, listingId: r.listingId, status: r.status, outcome: r.outcome, submittedAt: r.submittedAt?.toISOString() ?? null, title: r.title, publicId: r.publicId, listingState: r.state }));
  }),
  get: adminCapabilityProcedure('REVIEW_PUBLICATION').input(idInput).query(async ({ ctx, input }) => {
    const [req] = await ctx.tx.select().from(listingPublicationRequests).where(eq(listingPublicationRequests.id, input.id)).limit(1);
    if (!req) throw new TRPCError({ code: 'NOT_FOUND', message: 'NOT_AVAILABLE' });
    const [l] = await ctx.tx.select().from(listings).where(eq(listings.id, req.listingId)).limit(1);
    const photos = await ctx.tx.select({ n: count() }).from(properties).where(eq(properties.id, l?.propertyId ?? '00000000-0000-0000-0000-000000000000'));
    return {
      id: req.id,
      listingId: req.listingId,
      status: req.status,
      outcome: req.outcomeCategory,
      submittedAt: req.submittedAt?.toISOString() ?? null,
      listing: l ? { title: l.title, state: l.state, publicId: l.publicId, askingPriceAed: l.askingPrice ? Number(l.askingPrice) : null } : null,
      checklist: { readyToPublish: l?.state === 'READY_TO_PUBLISH' || l?.state === 'LIVE', hasProperty: Number(photos[0]?.n ?? 0) > 0 },
    };
  }),
  approve: adminCapabilityProcedure('REVIEW_PUBLICATION').input(z.object({ requestId: z.string().uuid(), note: z.string().max(1000).optional() })).mutation(async ({ ctx, input }) => {
    const [req] = await ctx.tx.select().from(listingPublicationRequests).where(eq(listingPublicationRequests.id, input.requestId)).limit(1);
    if (!req || req.status !== 'PENDING') throw new TRPCError({ code: 'CONFLICT', message: 'STALE' });
    try {
      // Reuse the canonical Week-3 compensated resolver (spec §19.1); admin is the actor.
      await PublicationReviewService.resolve({ tx: ctx.tx, userId: ctx.user.id, listingId: req.listingId });
      await ctx.tx.insert(auditEvents).values({ actorId: ctx.user.id, action: 'ADMIN_PUBLICATION_APPROVED_DEMO', entityType: 'listing', entityId: req.listingId, metadata: {} });
      return { ok: true as const };
    } catch (e) {
      mapAdminError(e);
    }
  }),
  returnForChanges: adminCapabilityProcedure('REVIEW_PUBLICATION').input(z.object({ requestId: z.string().uuid(), reason: returnForChangesReasonSchema, note: z.string().max(1000).optional() })).mutation(async ({ ctx, input }) => {
    try {
      // SECURITY DEFINER: the owner notification insert is RLS-blocked on the admin's
      // own connection (a user may only insert their own notifications) — the function
      // does the update + audit + notification atomically with elevated privilege.
      await ctx.tx.execute(sql`select public.admin_return_publication(${input.requestId}::uuid, ${input.reason})`);
      return { ok: true as const };
    } catch (e) {
      mapAdminError(e);
    }
  }),
});

// ---------------------------------------------------------------------------
const verificationsRouter = router({
  list: adminCapabilityProcedure('VIEW_VERIFICATIONS').input(page).query(async ({ ctx, input }) => {
    const rows = await ctx.tx.select().from(verifications).orderBy(desc(verifications.updatedAt)).limit(input.limit).offset(input.offset);
    return rows.map((r) => ({ id: r.id, listingId: r.listingId, kind: r.kind, status: r.status, failureReason: r.failureReason, superseded: r.supersededAt != null, createdAt: r.createdAt.toISOString() }));
  }),
  get: adminCapabilityProcedure('VIEW_VERIFICATIONS').input(idInput).query(async ({ ctx, input }) => {
    const [r] = await ctx.tx.select().from(verifications).where(eq(verifications.id, input.id)).limit(1);
    if (!r) throw new TRPCError({ code: 'NOT_FOUND', message: 'NOT_AVAILABLE' });
    return { id: r.id, listingId: r.listingId, kind: r.kind, status: r.status, failureReason: r.failureReason, superseded: r.supersededAt != null, createdAt: r.createdAt.toISOString() };
  }),
  retry: adminCapabilityProcedure('RETRY_SIMULATION').input(z.object({ verificationId: z.string().uuid(), reason: z.string().max(200) })).mutation(async ({ ctx, input }) => {
    try {
      await ctx.tx.execute(sql`select id from public.admin_retry_verification(${input.verificationId}::uuid, ${input.reason})`);
      return { ok: true as const };
    } catch (e) {
      mapAdminError(e);
    }
  }),
});

// ---------------------------------------------------------------------------
const offersRouter = router({
  list: adminCapabilityProcedure('VIEW_OFFERS').input(page.extend({ status: z.string().optional() })).query(async ({ ctx, input }) => {
    const conds = input.status ? [eq(offerThreads.status, input.status as 'ACCEPTED')] : [];
    const rows = await ctx.tx.select().from(offerThreads).where(conds.length ? and(...conds) : undefined).orderBy(desc(offerThreads.lastActivityAt)).limit(input.limit).offset(input.offset);
    return rows.map((r) => ({ id: r.id, status: r.status, nextActor: r.nextActor, buyerSeq: r.buyerSeq, acceptedProposalId: r.acceptedProposalId, lastActivityAt: r.lastActivityAt.toISOString() }));
  }),
  get: adminCapabilityProcedure('VIEW_OFFERS').input(idInput).query(async ({ ctx, input }) => {
    const [t] = await ctx.tx.select().from(offerThreads).where(eq(offerThreads.id, input.id)).limit(1);
    if (!t) throw new TRPCError({ code: 'NOT_FOUND', message: 'NOT_AVAILABLE' });
    const props = await ctx.tx.select().from(offerProposals).where(eq(offerProposals.threadId, t.id)).orderBy(offerProposals.createdAt);
    return {
      id: t.id,
      status: t.status,
      nextActor: t.nextActor,
      acceptedProposalId: t.acceptedProposalId,
      closedReason: t.closedReason,
      // Immutable proposal history (admin read-only, spec §25).
      proposals: props.map((p) => ({ id: p.id, side: p.createdBySide, amountAed: Number(p.amountAed), status: p.status, createdAt: p.createdAt.toISOString() })),
    };
  }),
  close: adminCapabilityProcedure('CLOSE_INVALID_OFFER').input(z.object({ threadId: z.string().uuid(), reason: offerCloseReasonSchema })).mutation(async ({ ctx, input }) => {
    try {
      await ctx.tx.execute(sql`select id from public.admin_close_offer_thread(${input.threadId}::uuid, ${input.reason})`);
      return { ok: true as const };
    } catch (e) {
      mapAdminError(e);
    }
  }),
});

// ---------------------------------------------------------------------------
const transactionsRouter = router({
  list: adminCapabilityProcedure('VIEW_TRANSACTIONS').input(page.extend({ status: z.string().optional(), query: z.string().max(60).optional() })).query(async ({ ctx, input }) => {
    const conds = [];
    if (input.status) conds.push(eq(transactions.status, input.status as 'FAILED'));
    if (input.query) conds.push(ilike(transactions.reference, `%${input.query}%`));
    const rows = await ctx.tx.select().from(transactions).where(conds.length ? and(...conds) : undefined).orderBy(desc(transactions.updatedAt)).limit(input.limit).offset(input.offset);
    return rows.map((r) => ({ id: r.id, reference: r.reference, status: r.status, nextActor: r.nextActor, acceptedAmountAed: Number(r.acceptedAmountAed), paused: r.progressionPausedAt != null, updatedAt: r.updatedAt.toISOString() }));
  }),
  get: adminCapabilityProcedure('VIEW_TRANSACTIONS').input(idInput).query(async ({ ctx, input }) => {
    const [r] = await ctx.tx.select().from(transactions).where(eq(transactions.id, input.id)).limit(1);
    if (!r) throw new TRPCError({ code: 'NOT_FOUND', message: 'NOT_AVAILABLE' });
    return {
      id: r.id,
      reference: r.reference,
      status: r.status,
      nextActor: r.nextActor,
      acceptedAmountAed: Number(r.acceptedAmountAed),
      purchaseRoute: r.purchaseRoute,
      failureCategory: r.failureCategory,
      paused: r.progressionPausedAt != null,
      pauseReason: r.progressionPauseReason,
      version: r.version,
      updatedAt: r.updatedAt.toISOString(),
    };
  }),
  pause: adminCapabilityProcedure('MANAGE_TRANSACTION_RECOVERY').input(z.object({ transactionId: z.string().uuid(), reason: z.string().max(80) })).mutation(async ({ ctx, input }) => {
    try {
      await ctx.tx.execute(sql`select id from public.admin_pause_transaction(${input.transactionId}::uuid, ${input.reason})`);
      return { ok: true as const };
    } catch (e) {
      mapAdminError(e);
    }
  }),
  resume: adminCapabilityProcedure('MANAGE_TRANSACTION_RECOVERY').input(z.object({ transactionId: z.string().uuid(), reason: z.string().max(80) })).mutation(async ({ ctx, input }) => {
    try {
      await ctx.tx.execute(sql`select id from public.admin_resume_transaction(${input.transactionId}::uuid, ${input.reason})`);
      return { ok: true as const };
    } catch (e) {
      mapAdminError(e);
    }
  }),
  retryStep: adminCapabilityProcedure('MANAGE_TRANSACTION_RECOVERY').input(z.object({ transactionId: z.string().uuid(), code: z.string().max(60), reason: z.string().max(200) })).mutation(async ({ ctx, input }) => {
    try {
      await ctx.tx.execute(sql`select id from public.admin_retry_transaction_step(${input.transactionId}::uuid, ${input.code}, ${input.reason})`);
      return { ok: true as const };
    } catch (e) {
      mapAdminError(e);
    }
  }),
  markFailed: adminCapabilityProcedure('MANAGE_TRANSACTION_RECOVERY').input(z.object({ transactionId: z.string().uuid(), reason: transactionFailReasonSchema })).mutation(async ({ ctx, input }) => {
    try {
      await ctx.tx.execute(sql`select id from public.admin_mark_transaction_failed(${input.transactionId}::uuid, ${input.reason}, ${input.reason})`);
      return { ok: true as const };
    } catch (e) {
      mapAdminError(e);
    }
  }),
  resolveCancellation: adminCapabilityProcedure('MANAGE_TRANSACTION_RECOVERY').input(z.object({ transactionId: z.string().uuid(), action: cancellationResolutionSchema, reason: z.string().max(200) })).mutation(async ({ ctx, input }) => {
    try {
      await ctx.tx.execute(sql`select id from public.admin_resolve_cancellation(${input.transactionId}::uuid, ${input.action}, ${input.reason})`);
      return { ok: true as const };
    } catch (e) {
      mapAdminError(e);
    }
  }),
});

// ---------------------------------------------------------------------------
const auditRouter = router({
  list: adminCapabilityProcedure('VIEW_AUDIT_LOGS')
    .input(page.extend({ entityType: z.string().max(40).optional(), entityId: z.string().uuid().optional(), action: z.string().max(60).optional() }))
    .query(async ({ ctx, input }) => {
      const conds = [];
      if (input.entityType) conds.push(eq(auditEvents.entityType, input.entityType));
      if (input.entityId) conds.push(eq(auditEvents.entityId, input.entityId));
      if (input.action) conds.push(eq(auditEvents.action, input.action));
      const rows = await ctx.tx.select().from(auditEvents).where(conds.length ? and(...conds) : undefined).orderBy(desc(auditEvents.createdAt)).limit(input.limit).offset(input.offset);
      return rows.map((r) => toAuditEvent(r as unknown as AuditRow));
    }),
  get: adminCapabilityProcedure('VIEW_AUDIT_LOGS').input(idInput).query(async ({ ctx, input }) => {
    const [r] = await ctx.tx.select().from(auditEvents).where(eq(auditEvents.id, input.id)).limit(1);
    if (!r) throw new TRPCError({ code: 'NOT_FOUND', message: 'NOT_AVAILABLE' });
    return toAuditEvent(r as unknown as AuditRow);
  }),
});

// ---------------------------------------------------------------------------
const documentsRouter = router({
  metadata: adminCapabilityProcedure('VIEW_PRIVATE_DOCUMENT_METADATA').input(z.object({ transactionId: z.string().uuid() })).query(async ({ ctx, input }) => {
    const docs = await ctx.tx.select().from(transactionDocuments).where(eq(transactionDocuments.transactionId, input.transactionId));
    return docs.map((d) => toAdminDocumentMetadata({ id: d.id, documentType: d.documentType, uploadedBy: d.uploadedBy, status: d.status, mimeType: d.mimeType, sizeBytes: d.sizeBytes, fileName: d.fileName, visibility: 'PRIVATE_TO_UPLOADER', createdAt: d.createdAt }));
  }),
  access: adminCapabilityProcedure('ACCESS_PRIVATE_DOCUMENT')
    .input(z.object({ transactionDocumentId: z.string().uuid(), reason: documentAccessReasonSchema }))
    .mutation(async ({ ctx, input }) => {
      const [doc] = await ctx.tx.select().from(transactionDocuments).where(eq(transactionDocuments.id, input.transactionDocumentId)).limit(1);
      if (!doc) throw new TRPCError({ code: 'NOT_FOUND', message: 'NOT_AVAILABLE' });
      // Exact lifecycle: REQUESTED before minting, then GRANTED / FAILED by outcome.
      // We RETURN (not throw) on failure so the FAILED audit commits — a thrown error
      // would roll back the whole transaction, losing every audit row written here.
      const rec = (phase: 'REQUESTED' | 'GRANTED' | 'FAILED') =>
        ctx.tx.execute(sql`select public.admin_record_document_access('transaction', ${doc.transactionId}::uuid, ${doc.documentType}, ${input.reason}, ${phase})`);
      await rec('REQUESTED');
      const url = await adminPrivateSignedUrl('transaction-documents', doc.storagePath, 300);
      if (!url) {
        await rec('FAILED');
        return { url: null as string | null, expiresInSeconds: 0 };
      }
      await rec('GRANTED');
      return { url: url as string | null, expiresInSeconds: 300 };
    }),
});

// ---------------------------------------------------------------------------
const searchRouter = router({
  query: adminProcedure.input(z.object({ q: z.string().min(2).max(120) })).query(async ({ ctx, input }) => {
    const like = `%${input.q}%`;
    const [customers, listingRows, txRows] = await Promise.all([
      ctx.tx.select({ id: profiles.id, name: profiles.fullName, email: profiles.email }).from(profiles).where(and(eq(profiles.accountType, 'CUSTOMER'), or(ilike(profiles.fullName, like), ilike(profiles.email, like)))).limit(5),
      ctx.tx.select({ id: listings.id, publicId: listings.publicId, title: listings.title }).from(listings).where(or(ilike(listings.publicId, like), ilike(listings.title, like))).limit(5),
      ctx.tx.select({ id: transactions.id, reference: transactions.reference }).from(transactions).where(ilike(transactions.reference, like)).limit(5),
    ]);
    return {
      customers: customers.map((c) => ({ id: c.id, label: c.name ?? c.email.split('@')[0] })),
      listings: listingRows.map((l) => ({ id: l.id, label: l.publicId ?? l.title })),
      transactions: txRows.map((t) => ({ id: t.id, label: t.reference })),
    };
  }),
});

export const adminRouter = router({
  overview: overviewRouter,
  search: searchRouter,
  customers: customersRouter,
  notes: notesRouter,
  listings: listingsRouter,
  publication: publicationRouter,
  verifications: verificationsRouter,
  offers: offersRouter,
  transactions: transactionsRouter,
  audit: auditRouter,
  documents: documentsRouter,
});
