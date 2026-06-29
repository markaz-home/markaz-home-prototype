import { randomBytes } from 'node:crypto';
import { and, desc, eq, isNull } from 'drizzle-orm';
import {
  listings,
  properties,
  propertyPhotos,
  permitRecords,
  listingPublicationRequests,
  auditEvents,
  copyDraftPhotoToPublic,
  removePublicPhotos,
  type Tx,
} from '@markaz/db';
import { buildListingSlug, formatPublicId, type PublicationResultCategory } from '@markaz/domain';
import type { DemoOutcome } from './simulation';

const isProd = () =>
  process.env.NODE_ENV === 'production' || process.env.DEMO_ENVIRONMENT === 'production';
/** Honour a forced FAILURE only outside production (tests). */
function forcedFailure(force?: DemoOutcome): boolean {
  return !isProd() && force === 'FAILURE';
}
async function audit(tx: Tx, actorId: string, action: string, entityId: string, metadata: Record<string, unknown> = {}) {
  await tx.insert(auditEvents).values({ actorId, action, entityType: 'listing', entityId, metadata });
}

export interface PubCtx {
  tx: Tx;
  userId: string;
  listingId: string;
}

async function currentRequest(tx: Tx, listingId: string) {
  const [r] = await tx
    .select()
    .from(listingPublicationRequests)
    .where(and(eq(listingPublicationRequests.listingId, listingId), isNull(listingPublicationRequests.supersededAt)))
    .orderBy(desc(listingPublicationRequests.createdAt))
    .limit(1);
  return r ?? null;
}

/**
 * Simulated publication review (design spec §5, §15). Validates eligibility,
 * persists a PENDING request, prepares public photos, and performs the ATOMIC
 * LIVE transition only after approval + photo readiness (§4.4). Never claims an
 * official/government/legal review. Idempotent; `demoOutcome` forces a return.
 */
export const PublicationReviewService = {
  /** Submit for review: supersede any prior request, create a fresh PENDING one. */
  async submit({ tx, userId, listingId }: PubCtx, force?: DemoOutcome) {
    const existing = await currentRequest(tx, listingId);
    if (existing && existing.status === 'PENDING') return existing; // idempotent (§5.2)
    if (existing) {
      await tx.update(listingPublicationRequests).set({ supersededAt: new Date() }).where(eq(listingPublicationRequests.id, existing.id));
    }
    const [req] = await tx
      .insert(listingPublicationRequests)
      .values({ listingId, sellerUserId: userId, status: 'PENDING', submittedAt: new Date(), outcomeCategory: forcedFailure(force) ? 'DEMO_REVIEW_RETURNED' : null })
      .returning();
    await audit(tx, userId, 'LISTING_PUBLICATION_SUBMITTED', listingId);
    return req!;
  },

  /** Resolve a PENDING request: re-validate, prepare public photos, flip LIVE or return. */
  async resolve({ tx, userId, listingId }: PubCtx) {
    const req = await currentRequest(tx, listingId);
    if (!req || req.status !== 'PENDING') return req;

    const reject = async (category: PublicationResultCategory, action: string) => {
      await tx
        .update(listingPublicationRequests)
        .set({ status: 'REJECTED_DEMO', outcomeCategory: category, resolvedAt: new Date() })
        .where(eq(listingPublicationRequests.id, req.id));
      await audit(tx, userId, action, listingId, { category });
      const [updated] = await tx.select().from(listingPublicationRequests).where(eq(listingPublicationRequests.id, req.id)).limit(1);
      return updated ?? null;
    };

    // Forced demo failure (tests).
    if (req.outcomeCategory === 'DEMO_REVIEW_RETURNED') {
      return reject('DEMO_REVIEW_RETURNED', 'LISTING_PUBLICATION_RETURNED_DEMO');
    }

    // Re-validate the atomic-LIVE gate (§4.4).
    const [listing] = await tx.select().from(listings).where(eq(listings.id, listingId)).limit(1);
    if (!listing || listing.state !== 'READY_TO_PUBLISH') return reject('CHECKLIST_INCOMPLETE', 'LISTING_PUBLICATION_RETURNED_DEMO');
    const photos = await tx.select().from(propertyPhotos).where(eq(propertyPhotos.listingId, listingId)).orderBy(propertyPhotos.sortOrder);
    const hasCover = photos.some((p) => p.isCover);
    const askingOk = listing.askingPrice != null && Number(listing.askingPrice) > 0;
    const [permit] = await tx
      .select()
      .from(permitRecords)
      .where(and(eq(permitRecords.listingId, listingId), isNull(permitRecords.supersededAt)))
      .orderBy(desc(permitRecords.createdAt))
      .limit(1);
    if (photos.length < 1 || !hasCover || !askingOk || permit?.status !== 'VERIFIED_DEMO') {
      return reject('CHECKLIST_INCOMPLETE', 'LISTING_PUBLICATION_RETURNED_DEMO');
    }

    // Stable opaque public id (set once; preserved across re-publication).
    const publicId = listing.publicId ?? formatPublicId(randomBytes(6).toString('hex'));
    const [property] = listing.propertyId ? await tx.select().from(properties).where(eq(properties.id, listing.propertyId)).limit(1) : [null];
    const slug = buildListingSlug({
      bedrooms: property?.bedrooms ?? null,
      propertyType: property?.propertyType ?? null,
      community: property?.community ?? null,
      buildingOrProject: property?.buildingOrProject ?? null,
    });

    // Prepare PUBLIC photos (copy draft → public). All-or-nothing.
    const prepared: string[] = [];
    try {
      for (const photo of photos) {
        const publicPath = `${publicId}/${photo.id}`;
        await copyDraftPhotoToPublic(photo.storagePath, publicPath, photo.contentType ?? undefined);
        await tx.update(propertyPhotos).set({ publicPath }).where(eq(propertyPhotos.id, photo.id));
        prepared.push(publicPath);
      }
    } catch {
      await removePublicPhotos(prepared);
      await tx.update(propertyPhotos).set({ publicPath: null }).where(eq(propertyPhotos.listingId, listingId));
      return reject('PHOTO_PROCESSING_FAILED', 'LISTING_PUBLIC_PHOTOS_FAILED');
    }
    await audit(tx, userId, 'LISTING_PUBLIC_PHOTOS_PREPARED', listingId, { count: prepared.length });

    // Atomic LIVE transition.
    const now = new Date();
    await tx
      .update(listings)
      .set({
        state: 'LIVE',
        publicId,
        publicSlug: slug,
        publishedAt: listing.publishedAt ?? now,
        publicUpdatedAt: now,
        pausedAt: null,
        publicationVersion: listing.publicationVersion + 1,
      })
      .where(eq(listings.id, listingId));
    await tx
      .update(listingPublicationRequests)
      .set({ status: 'APPROVED_DEMO', resolvedAt: now, outcomeCategory: null })
      .where(eq(listingPublicationRequests.id, req.id));
    await audit(tx, userId, 'LISTING_PUBLICATION_APPROVED_DEMO', listingId);
    await audit(tx, userId, 'LISTING_PUBLISHED', listingId, { publicId });

    const [updated] = await tx.select().from(listingPublicationRequests).where(eq(listingPublicationRequests.id, req.id)).limit(1);
    return updated ?? null;
  },

  /** Supersede a pending request after an invalidating edit (§5.2). */
  async supersedePending({ tx, listingId }: { tx: Tx; listingId: string }) {
    await tx
      .update(listingPublicationRequests)
      .set({ supersededAt: new Date() })
      .where(and(eq(listingPublicationRequests.listingId, listingId), eq(listingPublicationRequests.status, 'PENDING'), isNull(listingPublicationRequests.supersededAt)));
  },
};
