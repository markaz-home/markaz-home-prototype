import { and, desc, eq, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
  listings,
  properties,
  ownershipDocuments,
  investmentCases,
  savedProperties,
} from '@markaz/db';
import {
  propertyDetailsSchema,
  listingSettingsSchema,
  calculateInvestmentCase,
  computeReadiness,
  resolveNextStep,
  listingStageIndex,
  canPause,
  canResume,
  isPublicationEligible,
  classifyLiveEdit,
} from '@markaz/domain';
import { router, customerProcedure } from '../../trpc';
import { buildHeadline } from '../../public-projection';
import { num, audit, loadOwned, buildSnapshot, invalidateDownstream } from './shared';
import { documentRouter } from './document';
import { verificationRouter } from './verification';
import { investmentRouter } from './investment';
import { formARouter } from './formA';
import { photosRouter } from './photos';
import { permitRouter } from './permit';
import { reviewRouter } from './review';
import { publicationRouter } from './publication';

export const listingRouter = router({
  /** Create a new DRAFT listing for the authenticated customer. */
  create: customerProcedure.mutation(async ({ ctx }) => {
    const [property] = await ctx.tx
      .insert(properties)
      .values({ ownerId: ctx.user.id, emirate: 'Dubai' })
      .returning({ id: properties.id });
    const [listing] = await ctx.tx
      .insert(listings)
      .values({
        ownerId: ctx.user.id,
        propertyId: property!.id,
        title: 'Untitled property',
        state: 'DRAFT',
        currentStep: 'details',
      })
      .returning({ id: listings.id });
    await audit(ctx.tx, ctx.user.id, 'LISTING_DRAFT_CREATED', listing!.id);
    return { listingId: listing!.id };
  }),

  /** The customer's listings, newest first, with progress + cover photo path. */
  list: customerProcedure.query(async ({ ctx }) => {
    const rows = await ctx.tx
      .select()
      .from(listings)
      .where(eq(listings.ownerId, ctx.user.id))
      .orderBy(desc(listings.updatedAt));
    const items = [] as Array<Record<string, unknown>>;
    for (const l of rows) {
      const snap = await buildSnapshot(ctx.tx, l.id);
      const readiness = computeReadiness(snap.progress);
      const cover = snap.photos.find((p) => p.isCover) ?? snap.photos[0] ?? null;
      items.push({
        id: l.id,
        title: l.title,
        community: snap.property?.community ?? null,
        buildingOrProject: snap.property?.buildingOrProject ?? null,
        state: l.state,
        completedRequired: readiness.completedRequired,
        totalRequired: readiness.totalRequired,
        ready: readiness.ready,
        nextStep: resolveNextStep(snap.progress),
        coverPhotoPath: cover?.storagePath ?? null,
        updatedAt: l.updatedAt.toISOString(),
      });
    }
    return items;
  }),

  /** Most recent resumable near-empty draft (for the /sell/new preflight). */
  resumableDraft: customerProcedure.query(async ({ ctx }) => {
    const [row] = await ctx.tx
      .select()
      .from(listings)
      .where(and(eq(listings.ownerId, ctx.user.id), eq(listings.state, 'DRAFT')))
      .orderBy(desc(listings.updatedAt))
      .limit(1);
    if (!row) return null;
    return { listingId: row.id, updatedAt: row.updatedAt.toISOString() };
  }),

  /** Full owned listing for the wizard. */
  get: customerProcedure
    .input(z.object({ listingId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const snap = await buildSnapshot(ctx.tx, input.listingId);
      const readiness = computeReadiness(snap.progress);
      return {
        id: snap.listing.id,
        state: snap.listing.state,
        version: snap.listing.version,
        title: snap.listing.title,
        description: snap.listing.description,
        askingPriceAed: num(snap.listing.askingPrice),
        minNotificationPriceAed: num(snap.listing.minNotificationPrice),
        investmentCaseVisible: snap.listing.investmentCaseVisible,
        property: snap.property
          ? {
              propertyType: snap.property.propertyType,
              emirate: snap.property.emirate,
              community: snap.property.community,
              buildingOrProject: snap.property.buildingOrProject,
              unitIdentifier: snap.property.unitIdentifier,
              bedrooms: snap.property.bedrooms,
              bathrooms: snap.property.bathrooms,
              sizeSqft: snap.property.sizeSqft ? Number(snap.property.sizeSqft) : null,
              furnishingStatus: snap.property.furnishingStatus,
              occupancyStatus: snap.property.occupancyStatus,
              completionStatus: snap.property.completionStatus,
              parkingSpaces: snap.property.parkingSpaces,
              features: snap.property.features ?? [],
            }
          : null,
        document: snap.doc
          ? {
              documentType: snap.doc.documentType,
              originalName: snap.doc.originalName,
              status: snap.doc.status,
              uploadedAt: snap.doc.createdAt.toISOString(),
            }
          : null,
        verification: snap.ver
          ? { status: snap.ver.status, failureReason: snap.ver.failureReason }
          : { status: 'NOT_STARTED', failureReason: null },
        formA: snap.formA
          ? { status: snap.formA.status, signedAt: snap.formA.signedAt?.toISOString() ?? null }
          : { status: 'NOT_STARTED', signedAt: null },
        permit: snap.permit
          ? {
              status: snap.permit.status,
              permitNumber: snap.permit.permitNumber,
              failureReason: snap.permit.failureReason,
              approvedAt: snap.permit.approvedAt?.toISOString() ?? null,
            }
          : { status: 'NOT_STARTED', permitNumber: null, failureReason: null, approvedAt: null },
        photos: snap.photos.map((p) => ({
          id: p.id,
          storagePath: p.storagePath,
          isCover: p.isCover,
          sortOrder: p.sortOrder,
          originalName: p.originalName,
        })),
        investmentCase: snap.ic
          ? {
              originalPurchasePriceAed: num(snap.ic.originalPurchasePrice),
              purchaseDate: snap.ic.purchaseDate,
              renovationCostsAed: num(snap.ic.renovationCosts),
              totalInvestedAed: num(snap.ic.totalInvested),
              estimatedGainAed: num(snap.ic.estimatedGain),
              estimatedRoiPct: num(snap.ic.estimatedRoiPct),
              estimatedAnnualisedReturnPct: num(snap.ic.estimatedAnnualisedReturnPct),
              pricePerSqftAed: num(snap.ic.pricePerSqft),
              visible: snap.ic.visible,
            }
          : null,
        investmentSkipped: snap.listing.investmentCaseSkipped,
        sections: readiness.statuses,
        readiness: {
          ready: readiness.ready,
          blocking: readiness.blocking,
          completedRequired: readiness.completedRequired,
          totalRequired: readiness.totalRequired,
        },
        nextStep: resolveNextStep(snap.progress),
      };
    }),

  /** Save Property Details → DETAILS_COMPLETE. Invalidates Form A / permit downstream. */
  saveDetails: customerProcedure
    .input(
      propertyDetailsSchema.and(
        z.object({ listingId: z.string().uuid(), title: z.string().trim().max(140).optional() }),
      ),
    )
    .mutation(async ({ ctx, input }) => {
      const listing = await loadOwned(ctx.tx, input.listingId);
      if (!listing.propertyId)
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Listing has no property.' });
      await ctx.tx
        .update(properties)
        .set({
          propertyType: input.propertyType,
          emirate: 'Dubai',
          community: input.community,
          buildingOrProject: input.buildingOrProject || null,
          unitIdentifier: input.unitIdentifier,
          bedrooms: input.bedrooms,
          bathrooms: input.bathrooms,
          sizeSqft: String(input.sizeSqft),
          furnishingStatus: input.furnishingStatus,
          occupancyStatus: input.occupancyStatus,
          completionStatus: input.completionStatus,
          parkingSpaces: input.parkingSpaces ?? null,
          features: input.features ?? [],
        })
        .where(eq(properties.id, listing.propertyId));
      const title =
        input.title?.trim() ||
        `${input.buildingOrProject || input.community}${input.unitIdentifier ? `, ${input.unitIdentifier}` : ''}`.trim() ||
        'Untitled property';
      await ctx.tx
        .update(listings)
        .set({ description: input.description, title, currentStep: 'ownership' })
        .where(eq(listings.id, input.listingId));
      // Advance DRAFT → DETAILS_COMPLETE; invalidate Form A/permit if editing later.
      if (listing.state === 'DRAFT') {
        await ctx.tx
          .update(listings)
          .set({ state: 'DETAILS_COMPLETE' })
          .where(eq(listings.id, input.listingId));
      } else if (listingStageIndex(listing.state) > listingStageIndex('OWNERSHIP_VERIFIED')) {
        await invalidateDownstream(ctx.tx, input.listingId, listing.state, 'OWNERSHIP_VERIFIED');
      }
      await audit(ctx.tx, ctx.user.id, 'LISTING_DETAILS_COMPLETED', input.listingId);
      return { ok: true as const };
    }),

  /**
   * Debounced autosave for editable form steps (Property Details, Settings).
   * Persists whatever partial, valid fields are present WITHOUT validating step
   * completeness or transitioning state. Optimistic concurrency: the caller sends
   * the version it last saw; a mismatch means another tab/device saved first →
   * CONFLICT (the UI prompts a refresh). Bumps version on success.
   */
  saveDraft: customerProcedure
    .input(
      z.object({
        listingId: z.string().uuid(),
        version: z.number().int(),
        property: z
          .object({
            propertyType: z.string().nullish(),
            community: z.string().nullish(),
            buildingOrProject: z.string().nullish(),
            unitIdentifier: z.string().nullish(),
            bedrooms: z.number().int().nullish(),
            bathrooms: z.number().int().nullish(),
            sizeSqft: z.number().nullish(),
            furnishingStatus: z.string().nullish(),
            occupancyStatus: z.string().nullish(),
            completionStatus: z.string().nullish(),
            parkingSpaces: z.number().int().nullish(),
            features: z.array(z.string()).nullish(),
          })
          .optional(),
        description: z.string().nullish(),
        askingPriceAed: z.number().nullish(),
        minNotificationPriceAed: z.number().nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const listing = await loadOwned(ctx.tx, input.listingId);
      if (listing.version !== input.version) {
        throw new TRPCError({ code: 'CONFLICT', message: 'This listing was updated elsewhere.' });
      }
      if (input.property && listing.propertyId) {
        const p = input.property;
        const set: Partial<typeof properties.$inferInsert> = {};
        if (p.propertyType !== undefined) set.propertyType = p.propertyType ?? null;
        if (p.community !== undefined) set.community = p.community ?? null;
        if (p.buildingOrProject !== undefined) set.buildingOrProject = p.buildingOrProject ?? null;
        if (p.unitIdentifier !== undefined) set.unitIdentifier = p.unitIdentifier ?? null;
        if (p.bedrooms !== undefined) set.bedrooms = p.bedrooms ?? null;
        if (p.bathrooms !== undefined) set.bathrooms = p.bathrooms ?? null;
        if (p.sizeSqft !== undefined) set.sizeSqft = p.sizeSqft == null ? null : String(p.sizeSqft);
        if (p.furnishingStatus !== undefined) set.furnishingStatus = p.furnishingStatus ?? null;
        if (p.occupancyStatus !== undefined) set.occupancyStatus = p.occupancyStatus ?? null;
        if (p.completionStatus !== undefined) set.completionStatus = p.completionStatus ?? null;
        if (p.parkingSpaces !== undefined) set.parkingSpaces = p.parkingSpaces ?? null;
        if (p.features !== undefined) set.features = p.features ?? [];
        if (Object.keys(set).length > 0)
          await ctx.tx.update(properties).set(set).where(eq(properties.id, listing.propertyId));
      }
      const lset: Partial<typeof listings.$inferInsert> = { version: listing.version + 1 };
      if (input.description !== undefined) lset.description = input.description ?? null;
      if (input.askingPriceAed !== undefined)
        lset.askingPrice = input.askingPriceAed == null ? null : String(input.askingPriceAed);
      if (input.minNotificationPriceAed !== undefined)
        lset.minNotificationPrice =
          input.minNotificationPriceAed == null ? null : String(input.minNotificationPriceAed);
      await ctx.tx.update(listings).set(lset).where(eq(listings.id, input.listingId));
      return { version: listing.version + 1 };
    }),

  /** Save Listing & Offer Settings. Invalidates Form A / permit downstream. */
  saveSettings: customerProcedure
    .input(listingSettingsSchema.and(z.object({ listingId: z.string().uuid() })))
    .mutation(async ({ ctx, input }) => {
      const listing = await loadOwned(ctx.tx, input.listingId);
      await ctx.tx
        .update(listings)
        .set({
          askingPrice: String(input.askingPriceAed),
          minNotificationPrice: String(input.minNotificationPriceAed),
          currentStep: 'investment-case',
        })
        .where(eq(listings.id, input.listingId));
      if (listingStageIndex(listing.state) > listingStageIndex('OWNERSHIP_VERIFIED')) {
        await invalidateDownstream(ctx.tx, input.listingId, listing.state, 'OWNERSHIP_VERIFIED');
      }
      // Recompute a persisted investment case if one exists (asking price changed).
      const [ic] = await ctx.tx
        .select()
        .from(investmentCases)
        .where(eq(investmentCases.listingId, input.listingId))
        .limit(1);
      if (ic) {
        const [property] = listing.propertyId
          ? await ctx.tx
              .select()
              .from(properties)
              .where(eq(properties.id, listing.propertyId))
              .limit(1)
          : [null];
        const calc = calculateInvestmentCase({
          askingPriceAed: input.askingPriceAed,
          originalPurchasePriceAed: Number(ic.originalPurchasePrice),
          renovationCostsAed: Number(ic.renovationCosts),
          purchaseDate: ic.purchaseDate,
          sizeSqft: property?.sizeSqft ? Number(property.sizeSqft) : null,
          asOf: new Date().toISOString().slice(0, 10),
        });
        await ctx.tx
          .update(investmentCases)
          .set({
            totalInvested: String(calc.totalInvestedAed),
            estimatedGain: String(calc.estimatedGainAed),
            estimatedRoiPct: calc.estimatedRoiPct === null ? null : String(calc.estimatedRoiPct),
            estimatedAnnualisedReturnPct:
              calc.estimatedAnnualisedReturnPct === null
                ? null
                : String(calc.estimatedAnnualisedReturnPct),
            pricePerSqft: calc.pricePerSqftAed === null ? null : String(calc.pricePerSqftAed),
          })
          .where(eq(investmentCases.listingId, input.listingId));
      }
      await audit(ctx.tx, ctx.user.id, 'LISTING_SETTINGS_SAVED', input.listingId);
      return { ok: true as const };
    }),

  /** Delete a draft (DB rows cascade). Returns storage paths for the caller to clean up. */
  delete: customerProcedure
    .input(z.object({ listingId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const snap = await buildSnapshot(ctx.tx, input.listingId);
      const docPaths = (
        await ctx.tx
          .select()
          .from(ownershipDocuments)
          .where(eq(ownershipDocuments.listingId, input.listingId))
      ).map((d) => d.storagePath);
      const photoPaths = snap.photos.map((p) => p.storagePath);
      await ctx.tx.delete(listings).where(eq(listings.id, input.listingId));
      await audit(ctx.tx, ctx.user.id, 'LISTING_DRAFT_DELETED', input.listingId);
      return { removedDocuments: docPaths, removedPhotos: photoPaths };
    }),

  document: documentRouter,
  verification: verificationRouter,
  investment: investmentRouter,
  formA: formARouter,
  photos: photosRouter,
  permit: permitRouter,
  review: reviewRouter,
  publication: publicationRouter,

  /** Live / paused management summary (owner-only). */
  manage: customerProcedure
    .input(z.object({ listingId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const snap = await buildSnapshot(ctx.tx, input.listingId);
      const l = snap.listing;
      const savedRows = await ctx.tx
        .select({ savedCount: sql<number>`count(*)::int` })
        .from(savedProperties)
        .where(eq(savedProperties.listingId, input.listingId));
      const savedCount = savedRows[0]?.savedCount ?? 0;
      return {
        state: l.state,
        publicId: l.publicId,
        slug: l.publicSlug,
        headline: buildHeadline({
          bedrooms: snap.property?.bedrooms ?? null,
          propertyType: snap.property?.propertyType ?? null,
          buildingOrProject: snap.property?.buildingOrProject ?? null,
          community: snap.property?.community ?? null,
        }),
        askingPriceAed: num(l.askingPrice),
        publishedAt: l.publishedAt?.toISOString() ?? null,
        pausedAt: l.pausedAt?.toISOString() ?? null,
        savedCount: Number(savedCount ?? 0),
      };
    }),

  /** Pause a LIVE listing (§18). Removes it from the public marketplace. */
  pause: customerProcedure
    .input(z.object({ listingId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const listing = await loadOwned(ctx.tx, input.listingId);
      if (!canPause(listing.state))
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Only a live listing can be paused.' });
      await ctx.tx
        .update(listings)
        .set({ state: 'PAUSED', pausedAt: new Date() })
        .where(eq(listings.id, input.listingId));
      // Pausing closes every active offer negotiation (§28.1); they never auto-resume.
      await ctx.tx.execute(
        sql`select public.close_listing_offers(${input.listingId}::uuid, 'LISTING_PAUSED')`,
      );
      await audit(ctx.tx, ctx.user.id, 'LISTING_PAUSED', input.listingId);
      return { state: 'PAUSED' as const };
    }),

  /** Resume a PAUSED listing back to LIVE, re-validating readiness (§18.3). */
  resume: customerProcedure
    .input(z.object({ listingId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const snap = await buildSnapshot(ctx.tx, input.listingId);
      if (!canResume(snap.listing.state))
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Only a paused listing can be resumed.',
        });
      if (!isPublicationEligible(snap.progress, num(snap.listing.askingPrice))) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'This listing needs publication review before it can become live again.',
        });
      }
      await ctx.tx
        .update(listings)
        .set({ state: 'LIVE', pausedAt: null, publicUpdatedAt: new Date() })
        .where(eq(listings.id, input.listingId));
      await audit(ctx.tx, ctx.user.id, 'LISTING_RESUMED', input.listingId);
      return { state: 'LIVE' as const };
    }),

  /** Classify a proposed live edit as non-material (stays LIVE) or material (§17.4). */
  classifyEdit: customerProcedure
    .input(z.object({ field: z.string().max(60) }))
    .query(({ input }) => {
      return { classification: classifyLiveEdit(input.field) };
    }),

  /** Apply an approved non-material edit to a LIVE listing and refresh its public projection. */
  applyNonMaterialEdit: customerProcedure
    .input(
      z.object({
        listingId: z.string().uuid(),
        description: z.string().max(2000).optional(),
        features: z.array(z.string()).max(15).optional(),
        investmentCaseVisible: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const listing = await loadOwned(ctx.tx, input.listingId);
      if (listing.state !== 'LIVE')
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'This edit applies to a live listing.',
        });
      if (input.description !== undefined)
        await ctx.tx
          .update(listings)
          .set({ description: input.description })
          .where(eq(listings.id, input.listingId));
      if (input.features !== undefined && listing.propertyId)
        await ctx.tx
          .update(properties)
          .set({ features: input.features })
          .where(eq(properties.id, listing.propertyId));
      if (input.investmentCaseVisible !== undefined) {
        await ctx.tx
          .update(listings)
          .set({ investmentCaseVisible: input.investmentCaseVisible })
          .where(eq(listings.id, input.listingId));
        await ctx.tx
          .update(investmentCases)
          .set({ visible: input.investmentCaseVisible })
          .where(eq(investmentCases.listingId, input.listingId));
      }
      await ctx.tx
        .update(listings)
        .set({ publicUpdatedAt: new Date() })
        .where(eq(listings.id, input.listingId));
      return { ok: true as const };
    }),

  /** Owner-only public-projection preview (excludes all private fields). */
  preview: customerProcedure
    .input(z.object({ listingId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const snap = await buildSnapshot(ctx.tx, input.listingId);
      return toPublicProjection(snap);
    }),
});

/**
 * Public-projection mapper (design spec §20–21). Emits ONLY fields that may
 * appear on a future public listing — never the ownership document, the private
 * unit identifier, occupancy status, or a hidden Investment Case. Tested
 * independently so publication later cannot leak private data.
 */
export function toPublicProjection(snap: Awaited<ReturnType<typeof buildSnapshot>>) {
  const p = snap.property;
  const cover = snap.photos.find((x) => x.isCover) ?? snap.photos[0] ?? null;
  const showInvestment = snap.ic?.visible === true;
  // Public-safe title derived from public fields only — never the stored owner
  // title, which may contain the PRIVATE unit identifier (§11.2 vs §21.5).
  const publicTitle =
    [p?.buildingOrProject, p?.community].filter(Boolean).join(' · ') || 'Property listing';
  return {
    id: snap.listing.id,
    isLive: false as const,
    title: publicTitle,
    description: snap.listing.description,
    askingPriceAed: num(snap.listing.askingPrice),
    property: p
      ? {
          propertyType: p.propertyType,
          emirate: p.emirate,
          community: p.community,
          buildingOrProject: p.buildingOrProject,
          bedrooms: p.bedrooms,
          bathrooms: p.bathrooms,
          sizeSqft: p.sizeSqft ? Number(p.sizeSqft) : null,
          furnishingStatus: p.furnishingStatus,
          completionStatus: p.completionStatus,
          parkingSpaces: p.parkingSpaces,
          features: p.features ?? [],
          // NOTE: unitIdentifier + occupancyStatus are PRIVATE and intentionally omitted.
        }
      : null,
    coverPhotoPath: cover?.storagePath ?? null,
    photoPaths: snap.photos.map((x) => x.storagePath),
    investmentCase: showInvestment
      ? {
          estimatedRoiPct: num(snap.ic!.estimatedRoiPct),
          estimatedAnnualisedReturnPct: num(snap.ic!.estimatedAnnualisedReturnPct),
          pricePerSqftAed: num(snap.ic!.pricePerSqft),
        }
      : null,
  };
}
