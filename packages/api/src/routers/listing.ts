import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
  listings,
  properties,
  ownershipDocuments,
  verifications,
  formARecords,
  permitRecords,
  propertyPhotos,
  investmentCases,
  savedProperties,
  auditEvents,
  type Tx,
} from '@markaz/db';
import {
  propertyDetailsSchema,
  listingSettingsSchema,
  investmentCaseSchema,
  calculateInvestmentCase,
  computeReadiness,
  resolveNextStep,
  listingStageIndex,
  canRewindListing,
  publicationChecklist,
  isPublicationEligible,
  classifyLiveEdit,
  canPause,
  canResume,
  type ListingProgressInput,
} from '@markaz/domain';
import { router, customerProcedure } from '../trpc';
import {
  OwnershipVerificationService,
  FormAService,
  PermitService,
  type DemoOutcome,
} from '../services/simulation';
import { PublicationReviewService } from '../services/publication';
import { buildHeadline } from '../public-projection';

const demoOutcome = z.enum(['SUCCESS', 'FAILURE']).optional();

function num(v: string | null): number | null {
  return v === null ? null : Number(v);
}

async function audit(
  tx: Tx,
  actorId: string,
  action: string,
  entityId: string,
  metadata: Record<string, unknown> = {},
) {
  await tx
    .insert(auditEvents)
    .values({ actorId, action, entityType: 'listing', entityId, metadata });
}

/** Load a listing the caller owns (RLS scopes to owner). NOT_FOUND == forbidden (anti-enumeration). */
async function loadOwned(tx: Tx, listingId: string) {
  const [row] = await tx.select().from(listings).where(eq(listings.id, listingId)).limit(1);
  if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'This listing is not available.' });
  return row;
}

async function loadActiveDoc(tx: Tx, listingId: string) {
  const [d] = await tx
    .select()
    .from(ownershipDocuments)
    .where(and(eq(ownershipDocuments.listingId, listingId), eq(ownershipDocuments.active, true)))
    .limit(1);
  return d ?? null;
}
async function latest<T extends { createdAt: Date }>(rows: T[]): Promise<T | null> {
  return rows[0] ?? null;
}
async function activeVerification(tx: Tx, listingId: string) {
  const rows = await tx
    .select()
    .from(verifications)
    .where(
      and(
        eq(verifications.listingId, listingId),
        eq(verifications.kind, 'OWNERSHIP'),
        isNull(verifications.supersededAt),
      ),
    )
    .orderBy(desc(verifications.createdAt))
    .limit(1);
  return latest(rows);
}
async function activeFormA(tx: Tx, listingId: string) {
  const rows = await tx
    .select()
    .from(formARecords)
    .where(and(eq(formARecords.listingId, listingId), isNull(formARecords.supersededAt)))
    .orderBy(desc(formARecords.createdAt))
    .limit(1);
  return latest(rows);
}
async function activePermit(tx: Tx, listingId: string) {
  const rows = await tx
    .select()
    .from(permitRecords)
    .where(and(eq(permitRecords.listingId, listingId), isNull(permitRecords.supersededAt)))
    .orderBy(desc(permitRecords.createdAt))
    .limit(1);
  return latest(rows);
}

function isDetailsComplete(
  p: typeof properties.$inferSelect | null,
  description: string | null,
): boolean {
  if (!p) return false;
  const parsed = propertyDetailsSchema.safeParse({
    propertyType: p.propertyType,
    emirate: 'DUBAI',
    community: p.community ?? '',
    buildingOrProject: p.buildingOrProject ?? '',
    unitIdentifier: p.unitIdentifier ?? '',
    bedrooms: p.bedrooms ?? -1,
    bathrooms: p.bathrooms ?? -1,
    sizeSqft: p.sizeSqft ? Number(p.sizeSqft) : -1,
    furnishingStatus: p.furnishingStatus ?? undefined,
    occupancyStatus: p.occupancyStatus ?? undefined,
    completionStatus: p.completionStatus ?? undefined,
    parkingSpaces: p.parkingSpaces ?? undefined,
    description: description ?? '',
    features: p.features ?? [],
  });
  return parsed.success;
}

const SIM = {
  VERIFIED_DEMO: 'VERIFIED_DEMO',
  FAILED_DEMO: 'FAILED_DEMO',
  PENDING: 'PENDING',
} as const;

/** Build the server-authoritative progress snapshot for the domain readiness logic. */
async function buildSnapshot(tx: Tx, listingId: string) {
  const listing = await loadOwned(tx, listingId);
  const [property] = listing.propertyId
    ? await tx.select().from(properties).where(eq(properties.id, listing.propertyId)).limit(1)
    : [null];
  const doc = await loadActiveDoc(tx, listingId);
  const ver = await activeVerification(tx, listingId);
  const formA = await activeFormA(tx, listingId);
  const permit = await activePermit(tx, listingId);
  const photos = await tx
    .select()
    .from(propertyPhotos)
    .where(eq(propertyPhotos.listingId, listingId))
    .orderBy(propertyPhotos.sortOrder);
  const [ic] = await tx
    .select()
    .from(investmentCases)
    .where(eq(investmentCases.listingId, listingId))
    .limit(1);

  const verStatus: ListingProgressInput['verification']['status'] =
    ver?.status === SIM.VERIFIED_DEMO
      ? 'VERIFIED'
      : ver?.status === SIM.PENDING
        ? 'PENDING'
        : ver?.status === SIM.FAILED_DEMO
          ? 'FAILED'
          : 'NOT_STARTED';
  const formAStatus: ListingProgressInput['formA']['status'] =
    formA?.status === SIM.VERIFIED_DEMO
      ? 'COMPLETE'
      : formA?.status === SIM.PENDING
        ? 'PENDING'
        : formA?.status === SIM.FAILED_DEMO
          ? 'FAILED'
          : 'NOT_STARTED';
  const permitStatus: ListingProgressInput['permit']['status'] =
    permit?.status === SIM.VERIFIED_DEMO
      ? 'APPROVED'
      : permit?.status === SIM.PENDING
        ? 'PENDING'
        : permit?.status === SIM.FAILED_DEMO
          ? 'FAILED'
          : 'NOT_STARTED';

  const asking = num(listing.askingPrice);
  const minNotif = num(listing.minNotificationPrice);
  const settingsComplete =
    !!asking && asking > 0 && !!minNotif && minNotif > 0 && minNotif <= asking;

  const progress: ListingProgressInput = {
    state: listing.state,
    detailsComplete: isDetailsComplete(property ?? null, listing.description),
    hasActiveDocument: !!doc,
    verification: { status: verStatus, fresh: true },
    settingsComplete,
    investment: {
      status: ic ? 'ADDED' : listing.investmentCaseSkipped ? 'SKIPPED' : 'NOT_STARTED',
    },
    formA: { status: formAStatus, fresh: true },
    photos: { count: photos.length, hasCover: photos.some((p) => p.isCover) },
    permit: { status: permitStatus, fresh: true },
    reviewConfirmed: listing.state === 'READY_TO_PUBLISH',
  };

  return { listing, property: property ?? null, doc, ver, formA, permit, photos, ic, progress };
}

/** Rewind the listing (and supersede invalidated downstream records) after an edit. */
async function invalidateDownstream(
  tx: Tx,
  listingId: string,
  currentState: string,
  target: string,
) {
  if (!canRewindListing(currentState as never, target as never)) return;
  await tx
    .update(formARecords)
    .set({ supersededAt: new Date() })
    .where(and(eq(formARecords.listingId, listingId), isNull(formARecords.supersededAt)));
  await tx
    .update(permitRecords)
    .set({ supersededAt: new Date() })
    .where(and(eq(permitRecords.listingId, listingId), isNull(permitRecords.supersededAt)));
  await tx
    .update(listings)
    .set({ state: target as never, reviewConfirmedAt: null })
    .where(eq(listings.id, listingId));
}

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

  // --- Ownership document ---------------------------------------------------
  document: router({
    register: customerProcedure
      .input(
        z.object({
          listingId: z.string().uuid(),
          documentType: z.enum(['TITLE_DEED', 'OQOOD']),
          storagePath: z.string().min(1),
          originalName: z.string().max(255).optional(),
          contentType: z.string().max(120).optional(),
          sizeBytes: z
            .number()
            .int()
            .positive()
            .max(10 * 1024 * 1024)
            .optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const listing = await loadOwned(ctx.tx, input.listingId);
        const replacing =
          listingStageIndex(listing.state) >= listingStageIndex('DOCUMENT_UPLOADED');
        await ctx.tx
          .update(ownershipDocuments)
          .set({ active: false })
          .where(
            and(
              eq(ownershipDocuments.listingId, input.listingId),
              eq(ownershipDocuments.active, true),
            ),
          );
        await ctx.tx.insert(ownershipDocuments).values({
          listingId: input.listingId,
          ownerId: ctx.user.id,
          documentType: input.documentType,
          storagePath: input.storagePath,
          originalName: input.originalName ?? null,
          contentType: input.contentType ?? null,
          sizeBytes: input.sizeBytes ?? null,
          active: true,
          status: 'PENDING',
        });
        // Replacing a document resets verification + everything downstream.
        await ctx.tx
          .update(verifications)
          .set({ supersededAt: new Date() })
          .where(
            and(eq(verifications.listingId, input.listingId), isNull(verifications.supersededAt)),
          );
        if (listing.state === 'DETAILS_COMPLETE') {
          await ctx.tx
            .update(listings)
            .set({ state: 'DOCUMENT_UPLOADED', currentStep: 'verification' })
            .where(eq(listings.id, input.listingId));
        } else if (listingStageIndex(listing.state) > listingStageIndex('DOCUMENT_UPLOADED')) {
          await invalidateDownstream(ctx.tx, input.listingId, listing.state, 'DOCUMENT_UPLOADED');
        }
        await audit(
          ctx.tx,
          ctx.user.id,
          replacing ? 'OWNERSHIP_DOCUMENT_REPLACED' : 'OWNERSHIP_DOCUMENT_UPLOADED',
          input.listingId,
          { documentType: input.documentType },
        );
        return { ok: true as const };
      }),

    remove: customerProcedure
      .input(z.object({ listingId: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        const listing = await loadOwned(ctx.tx, input.listingId);
        const removed = (
          await ctx.tx
            .select()
            .from(ownershipDocuments)
            .where(
              and(
                eq(ownershipDocuments.listingId, input.listingId),
                eq(ownershipDocuments.active, true),
              ),
            )
        ).map((d) => d.storagePath);
        await ctx.tx
          .update(ownershipDocuments)
          .set({ active: false })
          .where(eq(ownershipDocuments.listingId, input.listingId));
        await ctx.tx
          .update(verifications)
          .set({ supersededAt: new Date() })
          .where(
            and(eq(verifications.listingId, input.listingId), isNull(verifications.supersededAt)),
          );
        if (listingStageIndex(listing.state) > listingStageIndex('DETAILS_COMPLETE')) {
          await invalidateDownstream(ctx.tx, input.listingId, listing.state, 'DETAILS_COMPLETE');
          await ctx.tx
            .update(listings)
            .set({ state: 'DETAILS_COMPLETE' })
            .where(eq(listings.id, input.listingId));
        }
        await audit(ctx.tx, ctx.user.id, 'OWNERSHIP_DOCUMENT_REMOVED', input.listingId);
        return { removedDocuments: removed };
      }),
  }),

  // --- Ownership verification (§14) -----------------------------------------
  verification: router({
    start: customerProcedure
      .input(z.object({ listingId: z.string().uuid(), demoOutcome }))
      .mutation(async ({ ctx, input }) => {
        const listing = await loadOwned(ctx.tx, input.listingId);
        if (!(await loadActiveDoc(ctx.tx, input.listingId)))
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Upload a document first.' });
        if (listingStageIndex(listing.state) < listingStageIndex('DOCUMENT_UPLOADED'))
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Listing not ready for verification.',
          });
        return OwnershipVerificationService.start(
          { tx: ctx.tx, userId: ctx.user.id, listingId: input.listingId },
          input.demoOutcome as DemoOutcome | undefined,
        );
      }),
    status: customerProcedure
      .input(z.object({ listingId: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        await loadOwned(ctx.tx, input.listingId);
        const rec = await OwnershipVerificationService.resolve({
          tx: ctx.tx,
          userId: ctx.user.id,
          listingId: input.listingId,
        });
        return { status: rec?.status ?? 'NOT_STARTED', failureReason: rec?.failureReason ?? null };
      }),
    retry: customerProcedure
      .input(z.object({ listingId: z.string().uuid(), demoOutcome }))
      .mutation(async ({ ctx, input }) => {
        await loadOwned(ctx.tx, input.listingId);
        return OwnershipVerificationService.start(
          { tx: ctx.tx, userId: ctx.user.id, listingId: input.listingId },
          input.demoOutcome as DemoOutcome | undefined,
        );
      }),
  }),

  // --- Investment Case (§16) ------------------------------------------------
  investment: router({
    save: customerProcedure
      .input(investmentCaseSchema.and(z.object({ listingId: z.string().uuid() })))
      .mutation(async ({ ctx, input }) => {
        const listing = await loadOwned(ctx.tx, input.listingId);
        const asking = num(listing.askingPrice);
        if (!asking)
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Add an asking price first.' });
        const [property] = listing.propertyId
          ? await ctx.tx
              .select()
              .from(properties)
              .where(eq(properties.id, listing.propertyId))
              .limit(1)
          : [null];
        const calc = calculateInvestmentCase({
          askingPriceAed: asking,
          originalPurchasePriceAed: input.originalPurchasePriceAed,
          renovationCostsAed: input.renovationCostsAed,
          purchaseDate: input.purchaseDate,
          sizeSqft: property?.sizeSqft ? Number(property.sizeSqft) : null,
          asOf: new Date().toISOString().slice(0, 10),
        });
        const values = {
          listingId: input.listingId,
          originalPurchasePrice: String(input.originalPurchasePriceAed),
          purchaseDate: input.purchaseDate,
          renovationCosts: String(input.renovationCostsAed),
          totalInvested: String(calc.totalInvestedAed),
          estimatedGain: String(calc.estimatedGainAed),
          estimatedRoiPct: calc.estimatedRoiPct === null ? null : String(calc.estimatedRoiPct),
          estimatedAnnualisedReturnPct:
            calc.estimatedAnnualisedReturnPct === null
              ? null
              : String(calc.estimatedAnnualisedReturnPct),
          pricePerSqft: calc.pricePerSqftAed === null ? null : String(calc.pricePerSqftAed),
          visible: input.visible,
        };
        await ctx.tx
          .insert(investmentCases)
          .values(values)
          .onConflictDoUpdate({ target: investmentCases.listingId, set: values });
        await ctx.tx
          .update(listings)
          .set({
            investmentCaseVisible: input.visible,
            investmentCaseSkipped: false,
            currentStep: 'form-a',
          })
          .where(eq(listings.id, input.listingId));
        await audit(ctx.tx, ctx.user.id, 'INVESTMENT_CASE_SAVED', input.listingId, {
          visible: input.visible,
        });
        return { ok: true as const };
      }),
    skip: customerProcedure
      .input(z.object({ listingId: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        await loadOwned(ctx.tx, input.listingId);
        await ctx.tx
          .update(listings)
          .set({ investmentCaseSkipped: true, currentStep: 'form-a' })
          .where(eq(listings.id, input.listingId));
        await audit(ctx.tx, ctx.user.id, 'INVESTMENT_CASE_SKIPPED', input.listingId);
        return { ok: true as const };
      }),
    setVisibility: customerProcedure
      .input(z.object({ listingId: z.string().uuid(), visible: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        await loadOwned(ctx.tx, input.listingId);
        await ctx.tx
          .update(investmentCases)
          .set({ visible: input.visible })
          .where(eq(investmentCases.listingId, input.listingId));
        await ctx.tx
          .update(listings)
          .set({ investmentCaseVisible: input.visible })
          .where(eq(listings.id, input.listingId));
        await audit(ctx.tx, ctx.user.id, 'INVESTMENT_CASE_SAVED', input.listingId, {
          visible: input.visible,
        });
        return { ok: true as const };
      }),
    remove: customerProcedure
      .input(z.object({ listingId: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        await loadOwned(ctx.tx, input.listingId);
        await ctx.tx.delete(investmentCases).where(eq(investmentCases.listingId, input.listingId));
        await ctx.tx
          .update(listings)
          .set({ investmentCaseVisible: false, investmentCaseSkipped: true })
          .where(eq(listings.id, input.listingId));
        await audit(ctx.tx, ctx.user.id, 'INVESTMENT_CASE_SKIPPED', input.listingId);
        return { ok: true as const };
      }),
  }),

  // --- Simulated Form A (§17) -----------------------------------------------
  formA: router({
    complete: customerProcedure
      .input(z.object({ listingId: z.string().uuid(), confirm: z.literal(true), demoOutcome }))
      .mutation(async ({ ctx, input }) => {
        const snap = await buildSnapshot(ctx.tx, input.listingId);
        if (snap.progress.verification.status !== 'VERIFIED')
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Ownership not verified.' });
        if (!snap.progress.settingsComplete)
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Listing settings incomplete.' });
        return FormAService.complete(
          { tx: ctx.tx, userId: ctx.user.id, listingId: input.listingId },
          num(snap.listing.askingPrice) ?? 0,
          input.demoOutcome as DemoOutcome | undefined,
        );
      }),
  }),

  // --- Photos (§18) ---------------------------------------------------------
  photos: router({
    register: customerProcedure
      .input(
        z.object({
          listingId: z.string().uuid(),
          storagePath: z.string().min(1),
          originalName: z.string().max(255).optional(),
          contentType: z.string().max(120).optional(),
          sizeBytes: z
            .number()
            .int()
            .positive()
            .max(12 * 1024 * 1024)
            .optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await loadOwned(ctx.tx, input.listingId);
        const existing = await ctx.tx
          .select()
          .from(propertyPhotos)
          .where(eq(propertyPhotos.listingId, input.listingId));
        if (existing.length >= 20)
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'You can upload up to 20 photographs.',
          });
        const isFirst = existing.length === 0;
        const maxOrder = existing.reduce((m, p) => Math.max(m, p.sortOrder), -1);
        const [row] = await ctx.tx
          .insert(propertyPhotos)
          .values({
            listingId: input.listingId,
            storagePath: input.storagePath,
            originalName: input.originalName ?? null,
            contentType: input.contentType ?? null,
            sizeBytes: input.sizeBytes ?? null,
            isCover: isFirst,
            sortOrder: maxOrder + 1,
          })
          .returning({ id: propertyPhotos.id });
        await audit(ctx.tx, ctx.user.id, 'LISTING_PHOTOS_UPDATED', input.listingId);
        return { photoId: row!.id, isCover: isFirst };
      }),
    reorder: customerProcedure
      .input(
        z.object({ listingId: z.string().uuid(), orderedIds: z.array(z.string().uuid()).min(1) }),
      )
      .mutation(async ({ ctx, input }) => {
        await loadOwned(ctx.tx, input.listingId);
        for (let i = 0; i < input.orderedIds.length; i++) {
          await ctx.tx
            .update(propertyPhotos)
            .set({ sortOrder: i })
            .where(
              and(
                eq(propertyPhotos.id, input.orderedIds[i]!),
                eq(propertyPhotos.listingId, input.listingId),
              ),
            );
        }
        await audit(ctx.tx, ctx.user.id, 'LISTING_PHOTOS_UPDATED', input.listingId);
        return { ok: true as const };
      }),
    setCover: customerProcedure
      .input(z.object({ listingId: z.string().uuid(), photoId: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        await loadOwned(ctx.tx, input.listingId);
        await ctx.tx
          .update(propertyPhotos)
          .set({ isCover: false })
          .where(eq(propertyPhotos.listingId, input.listingId));
        await ctx.tx
          .update(propertyPhotos)
          .set({ isCover: true })
          .where(
            and(
              eq(propertyPhotos.id, input.photoId),
              eq(propertyPhotos.listingId, input.listingId),
            ),
          );
        await audit(ctx.tx, ctx.user.id, 'LISTING_COVER_PHOTO_CHANGED', input.listingId);
        return { ok: true as const };
      }),
    delete: customerProcedure
      .input(z.object({ listingId: z.string().uuid(), photoId: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        await loadOwned(ctx.tx, input.listingId);
        const [target] = await ctx.tx
          .select()
          .from(propertyPhotos)
          .where(
            and(
              eq(propertyPhotos.id, input.photoId),
              eq(propertyPhotos.listingId, input.listingId),
            ),
          )
          .limit(1);
        if (!target) throw new TRPCError({ code: 'NOT_FOUND' });
        await ctx.tx.delete(propertyPhotos).where(eq(propertyPhotos.id, input.photoId));
        // If the cover was removed, promote the new first photo.
        if (target.isCover) {
          const [next] = await ctx.tx
            .select()
            .from(propertyPhotos)
            .where(eq(propertyPhotos.listingId, input.listingId))
            .orderBy(propertyPhotos.sortOrder)
            .limit(1);
          if (next)
            await ctx.tx
              .update(propertyPhotos)
              .set({ isCover: true })
              .where(eq(propertyPhotos.id, next.id));
        }
        await audit(ctx.tx, ctx.user.id, 'LISTING_PHOTOS_UPDATED', input.listingId);
        return { removedPhotos: [target.storagePath] };
      }),
    /** Advance to PHOTOS_COMPLETE once ≥1 photo + a cover exist and Form A is complete. */
    complete: customerProcedure
      .input(z.object({ listingId: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        const snap = await buildSnapshot(ctx.tx, input.listingId);
        if (snap.progress.formA.status !== 'COMPLETE')
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Complete Form A first.' });
        if (snap.photos.length < 1 || !snap.photos.some((p) => p.isCover))
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Add at least one photo and a cover.',
          });
        if (snap.listing.state === 'FORM_A_COMPLETE') {
          await ctx.tx
            .update(listings)
            .set({ state: 'PHOTOS_COMPLETE', currentStep: 'trakheesi' })
            .where(eq(listings.id, input.listingId));
        }
        return { ok: true as const };
      }),
  }),

  // --- Simulated Trakheesi (§19) --------------------------------------------
  permit: router({
    submit: customerProcedure
      .input(z.object({ listingId: z.string().uuid(), confirm: z.literal(true), demoOutcome }))
      .mutation(async ({ ctx, input }) => {
        const snap = await buildSnapshot(ctx.tx, input.listingId);
        if (snap.progress.photos.count < 1 || !snap.progress.photos.hasCover)
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Photos incomplete.' });
        if (listingStageIndex(snap.listing.state) < listingStageIndex('PHOTOS_COMPLETE'))
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Listing not ready for the permit step.',
          });
        return PermitService.submit(
          { tx: ctx.tx, userId: ctx.user.id, listingId: input.listingId },
          input.demoOutcome as DemoOutcome | undefined,
        );
      }),
    status: customerProcedure
      .input(z.object({ listingId: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        await loadOwned(ctx.tx, input.listingId);
        const rec = await PermitService.resolve({
          tx: ctx.tx,
          userId: ctx.user.id,
          listingId: input.listingId,
        });
        return {
          status: rec?.status ?? 'NOT_STARTED',
          permitNumber: rec?.permitNumber ?? null,
          failureReason: rec?.failureReason ?? null,
        };
      }),
    retry: customerProcedure
      .input(z.object({ listingId: z.string().uuid(), demoOutcome }))
      .mutation(async ({ ctx, input }) => {
        await loadOwned(ctx.tx, input.listingId);
        return PermitService.submit(
          { tx: ctx.tx, userId: ctx.user.id, listingId: input.listingId },
          input.demoOutcome as DemoOutcome | undefined,
        );
      }),
  }),

  // --- Review + READY_TO_PUBLISH (§20–21) -----------------------------------
  review: router({
    status: customerProcedure
      .input(z.object({ listingId: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        const snap = await buildSnapshot(ctx.tx, input.listingId);
        const readiness = computeReadiness(snap.progress);
        return {
          sections: readiness.statuses,
          ready: readiness.ready,
          blocking: readiness.blocking,
        };
      }),
    markReady: customerProcedure
      .input(z.object({ listingId: z.string().uuid(), confirm: z.literal(true) }))
      .mutation(async ({ ctx, input }) => {
        const snap = await buildSnapshot(ctx.tx, input.listingId);
        const readiness = computeReadiness(snap.progress); // server-authoritative re-check
        if (!readiness.ready)
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Listing is not ready.' });
        if (snap.listing.state !== 'PERMIT_PENDING')
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Unexpected listing state.' });
        await ctx.tx
          .update(listings)
          .set({ state: 'READY_TO_PUBLISH', currentStep: 'ready', reviewConfirmedAt: new Date() })
          .where(eq(listings.id, input.listingId));
        await audit(ctx.tx, ctx.user.id, 'LISTING_READY_TO_PUBLISH', input.listingId);
        return { ok: true as const, state: 'READY_TO_PUBLISH' as const };
      }),
  }),

  // --- Publication (§12–§16) ------------------------------------------------
  publication: router({
    /** Publication checklist + eligibility for a READY_TO_PUBLISH listing. */
    checklist: customerProcedure
      .input(z.object({ listingId: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        const snap = await buildSnapshot(ctx.tx, input.listingId);
        const asking = num(snap.listing.askingPrice);
        return {
          items: publicationChecklist(snap.progress, asking),
          eligible: isPublicationEligible(snap.progress, asking),
          listingState: snap.listing.state,
        };
      }),
    /** Submit for simulated publication review (server re-validates eligibility). */
    submit: customerProcedure
      .input(
        z.object({
          listingId: z.string().uuid(),
          confirm: z.literal(true),
          demoOutcome: z.enum(['SUCCESS', 'FAILURE']).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const snap = await buildSnapshot(ctx.tx, input.listingId);
        if (snap.listing.state !== 'READY_TO_PUBLISH')
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Listing is not ready to publish.' });
        if (!isPublicationEligible(snap.progress, num(snap.listing.askingPrice)))
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Publication checklist is incomplete.',
          });
        const req = await PublicationReviewService.submit(
          { tx: ctx.tx, userId: ctx.user.id, listingId: input.listingId },
          input.demoOutcome as DemoOutcome | undefined,
        );
        return { status: req.status };
      }),
    /** Resolve the pending request (prepare public photos → atomic LIVE, or return). */
    status: customerProcedure
      .input(z.object({ listingId: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        await loadOwned(ctx.tx, input.listingId);
        const req = await PublicationReviewService.resolve({
          tx: ctx.tx,
          userId: ctx.user.id,
          listingId: input.listingId,
        });
        const [l] = await ctx.tx
          .select({ state: listings.state, publicId: listings.publicId, slug: listings.publicSlug })
          .from(listings)
          .where(eq(listings.id, input.listingId))
          .limit(1);
        return {
          status: req?.status ?? 'NOT_SUBMITTED',
          outcomeCategory: req?.outcomeCategory ?? null,
          listingState: l?.state ?? null,
          publicId: l?.publicId ?? null,
          slug: l?.slug ?? null,
        };
      }),
    /** Resubmit after a returned review. */
    retry: customerProcedure
      .input(
        z.object({
          listingId: z.string().uuid(),
          demoOutcome: z.enum(['SUCCESS', 'FAILURE']).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const snap = await buildSnapshot(ctx.tx, input.listingId);
        if (!isPublicationEligible(snap.progress, num(snap.listing.askingPrice)))
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Publication checklist is incomplete.',
          });
        const req = await PublicationReviewService.submit(
          { tx: ctx.tx, userId: ctx.user.id, listingId: input.listingId },
          input.demoOutcome as DemoOutcome | undefined,
        );
        return { status: req.status };
      }),
  }),

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
