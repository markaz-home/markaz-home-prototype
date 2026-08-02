import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { offerThreads, profiles, listings, marketplaceListings as mv, execRow } from '@markaz/db';
import { expiryOptionSchema, validateOfferAmount, type OfferThreadStatus } from '@markaz/domain';
import { toBuyerThread, offerPropertySummary } from '../../offer-projection';
import { router, customerProcedure } from '../../trpc';
import {
  ACTIVE_STATUSES,
  amountInput,
  versionedThread,
  mapOfferError,
  resolveExpiry,
  loadSummary,
  currentProposal,
  toThreadInput,
  summaryToProperty,
  matchesBuyerFilter,
  runCounter,
  runAccept,
  type ListingSummaryRow,
} from './shared';

export const buyerOffersRouter = router({
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
      if (!l || l.state !== 'LIVE')
        return { eligible: false as const, reason: 'UNAVAILABLE' as const };
      if (l.ownerId === ctx.user.id) return { eligible: false as const, reason: 'OWNER' as const };

      const [existing] = await ctx.tx
        .select({ id: offerThreads.id })
        .from(offerThreads)
        .where(
          and(
            eq(offerThreads.listingId, l.id),
            eq(offerThreads.buyerUserId, ctx.user.id),
            inArray(offerThreads.status, [...ACTIVE_STATUSES]),
          ),
        )
        .limit(1);
      if (existing)
        return {
          eligible: false as const,
          reason: 'ACTIVE_THREAD' as const,
          threadId: existing.id,
        };

      // "Under offer" is derived from an ACCEPTED thread, but that thread is private to
      // its participants — a non-participant buyer cannot see it under RLS. Use the
      // SECURITY DEFINER helper so eligibility is authoritative for everyone (§6.1),
      // matching the block that create_offer enforces at submit time.
      const acc = await execRow<{ under_offer: boolean }>(
        ctx.tx,
        sql`select public.listing_has_accepted_offer(${l.id}::uuid) as under_offer`,
      );
      const underOffer = acc?.under_offer ?? false;
      if (underOffer) return { eligible: false as const, reason: 'UNDER_OFFER' as const };

      const [me] = await ctx.tx
        .select({ onboarded: profiles.onboardingCompletedAt })
        .from(profiles)
        .where(eq(profiles.id, ctx.user.id))
        .limit(1);
      if (!me?.onboarded) return { eligible: false as const, reason: 'ONBOARDING' as const };

      // Pre-thread property summary comes from the PUBLIC marketplace view — the
      // buyer is not yet a thread participant, so the participant-gated summary fn
      // would return nothing here.
      const [row] = await ctx.tx
        .select({
          publicId: mv.publicId,
          publicSlug: mv.publicSlug,
          askingPrice: mv.askingPrice,
          bedrooms: mv.bedrooms,
          bathrooms: mv.bathrooms,
          propertyType: mv.propertyType,
          community: mv.community,
          buildingOrProject: mv.buildingOrProject,
          emirate: mv.emirate,
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
    .input(
      z.object({
        publicId: z.string().max(40),
        amountAed: amountInput,
        expiry: expiryOptionSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (validateOfferAmount(input.amountAed))
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'INVALID_AMOUNT' });
      const [l] = await ctx.tx
        .select({ id: listings.id })
        .from(listings)
        .where(eq(listings.publicId, input.publicId))
        .limit(1);
      if (!l) throw new TRPCError({ code: 'NOT_FOUND', message: 'NOT_FOUND' });

      // If an active thread already exists, resolve it idempotently (§15.3).
      const [existing] = await ctx.tx
        .select({ id: offerThreads.id })
        .from(offerThreads)
        .where(
          and(
            eq(offerThreads.listingId, l.id),
            eq(offerThreads.buyerUserId, ctx.user.id),
            inArray(offerThreads.status, [...ACTIVE_STATUSES]),
          ),
        )
        .limit(1);
      if (existing) return { threadId: existing.id, created: false as const };

      const expiresAt = resolveExpiry(input.expiry);
      try {
        const row = await execRow<{ id: string }>(
          ctx.tx,
          sql`select id::text as id from public.create_offer(${l.id}::uuid, ${input.amountAed}, ${expiresAt}::timestamptz)`,
        );
        const id = row?.id;
        return { threadId: id, created: true as const };
      } catch (e) {
        // A racing duplicate is treated as "view your existing offer".
        if ((e as { code?: string }).code === '23505') {
          const [t] = await ctx.tx
            .select({ id: offerThreads.id })
            .from(offerThreads)
            .where(
              and(
                eq(offerThreads.listingId, l.id),
                eq(offerThreads.buyerUserId, ctx.user.id),
                inArray(offerThreads.status, [...ACTIVE_STATUSES]),
              ),
            )
            .limit(1);
          if (t) return { threadId: t.id, created: false as const };
        }
        mapOfferError(e);
      }
    }),

  // ---- Lists ----------------------------------------------------------------
  /** Threads the current customer created (buyer perspective). */
  getBuyerThreads: customerProcedure
    .input(
      z
        .object({
          filter: z.enum(['all', 'action', 'waiting', 'accepted', 'closed']).default('all'),
        })
        .optional(),
    )
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
        if (!matchesBuyerFilter(t.status as OfferThreadStatus, t.nextActor, input?.filter ?? 'all'))
          continue;
        if (!summaries.has(t.listingId))
          summaries.set(t.listingId, await loadSummary(ctx.tx, t.listingId));
        const s = summaries.get(t.listingId);
        if (!s) continue;
        out.push(
          toBuyerThread({
            thread: toThreadInput(t),
            current: await currentProposal(ctx.tx, t.currentProposalId),
            property: summaryToProperty(s),
          }),
        );
      }
      return out;
    }),

  // ---- Mutations (server-authoritative via SQL functions) -------------------
  submitBuyerCounter: customerProcedure
    .input(versionedThread.extend({ amountAed: amountInput, expiry: expiryOptionSchema }))
    .mutation(({ ctx, input }) => runCounter(ctx, input)),

  acceptSellerCounter: customerProcedure
    .input(versionedThread.extend({ proposalId: z.string().uuid() }))
    .mutation(({ ctx, input }) => runAccept(ctx, input)),

  rejectSellerCounter: customerProcedure.input(versionedThread).mutation(async ({ ctx, input }) => {
    try {
      await ctx.tx.execute(
        sql`select public.reject_offer(${input.threadId}::uuid, ${input.expectedVersion}, ${null})`,
      );
      return { ok: true as const };
    } catch (e) {
      mapOfferError(e);
    }
  }),

  withdraw: customerProcedure.input(versionedThread).mutation(async ({ ctx, input }) => {
    try {
      await ctx.tx.execute(
        sql`select public.withdraw_offer(${input.threadId}::uuid, ${input.expectedVersion})`,
      );
      return { ok: true as const };
    } catch (e) {
      mapOfferError(e);
    }
  }),
});
