import { randomBytes } from 'node:crypto';
import { and, desc, eq, isNull } from 'drizzle-orm';
import {
  listings,
  properties,
  propertyPhotos,
  permitRecords,
  listingPublicationRequests,
  auditEvents,
  type Tx,
} from '@markaz/db';
import {
  copyDraftPhotoToPublic,
  removePublicPhotos,
  verifyPublicPhotos,
  setPublicPhotoPath,
  clearPublicPhotoPaths,
  publicPhotoKey,
} from '@markaz/db/storage-admin';
import { buildListingSlug, formatPublicId, type PublicationResultCategory } from '@markaz/domain';
import type { DemoOutcome } from './simulation';

const isProd = () =>
  process.env.NODE_ENV === 'production' || process.env.DEMO_ENVIRONMENT === 'production';
/** Honour a forced FAILURE only outside production (tests). */
function forcedFailure(force?: DemoOutcome): boolean {
  return !isProd() && force === 'FAILURE';
}

/** Non-production fault injection for compensation/retry tests (ignored in prod). */
export interface PublicationFault {
  photoFailAt?: number; // throw while copying the photo at this index
  dbTxFail?: boolean; // throw just before the atomic DB LIVE transition
}
function fault(inject?: PublicationFault): PublicationFault {
  return isProd() ? {} : (inject ?? {});
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
 * Simulated publication review (design spec §5, §15). NOT a real regulatory,
 * legal, government, or payment integration.
 *
 * Publication is an IDEMPOTENT, COMPENSATED workflow — Supabase Storage and
 * PostgreSQL do NOT share one cross-system transaction:
 *
 *   1. Validate eligibility (§4.4 gate).
 *   2. Prepare every public photo (service-role copy draft→public at the stable
 *      key `${publicId}/${photoId}`) and verify each object exists.
 *   3. On any photo failure: compensate (remove the public objects + clear the
 *      staged public_path), keep the listing non-LIVE, return a RETRYABLE failure.
 *   4. ATOMIC database LIVE transition (one PostgreSQL transaction): flip to LIVE
 *      + set publication metadata + approve the request.
 *   5. If the database transition fails after photos were prepared: compensate
 *      (Storage cleanup), keep the listing non-LIVE, leave the request PENDING
 *      (retryable). A later retry re-copies to the SAME keys (no duplicates).
 *
 * The public photo path is written ONLY here, via the service role — a customer
 * can never supply or change it (guard_public_photo_path trigger, migration 08.3).
 */
export const PublicationReviewService = {
  /** Submit for review: supersede any prior request, persist a stable public id,
   * create a fresh PENDING one. The public id stays non-public until LIVE (the
   * marketplace view requires state = LIVE), but fixing it now makes the photo
   * keys deterministic so a retry never creates duplicate public objects. */
  async submit({ tx, userId, listingId }: PubCtx, force?: DemoOutcome) {
    const existing = await currentRequest(tx, listingId);
    if (existing && existing.status === 'PENDING') return existing; // idempotent (§5.2)
    if (existing) {
      await tx.update(listingPublicationRequests).set({ supersededAt: new Date() }).where(eq(listingPublicationRequests.id, existing.id));
    }
    const [l] = await tx.select({ publicId: listings.publicId }).from(listings).where(eq(listings.id, listingId)).limit(1);
    if (l && !l.publicId) {
      await tx.update(listings).set({ publicId: formatPublicId(randomBytes(6).toString('hex')) }).where(eq(listings.id, listingId));
    }
    const [req] = await tx
      .insert(listingPublicationRequests)
      .values({ listingId, sellerUserId: userId, status: 'PENDING', submittedAt: new Date(), outcomeCategory: forcedFailure(force) ? 'DEMO_REVIEW_RETURNED' : null })
      .returning();
    await audit(tx, userId, 'LISTING_PUBLICATION_SUBMITTED', listingId);
    return req!;
  },

  /** Resolve a PENDING request: re-validate, prepare public photos, then perform
   * the atomic DB LIVE transition — with compensation on either failure path. */
  async resolve({ tx, userId, listingId }: PubCtx, inject?: PublicationFault) {
    const req = await currentRequest(tx, listingId);
    if (!req || req.status !== 'PENDING') return req; // idempotent: already resolved

    const f = fault(inject);
    const reject = async (category: PublicationResultCategory, action: string) => {
      await tx
        .update(listingPublicationRequests)
        .set({ status: 'REJECTED_DEMO', outcomeCategory: category, resolvedAt: new Date() })
        .where(eq(listingPublicationRequests.id, req.id));
      await audit(tx, userId, action, listingId, { category });
      const [updated] = await tx.select().from(listingPublicationRequests).where(eq(listingPublicationRequests.id, req.id)).limit(1);
      return updated ?? null;
    };

    // Forced demo return (existing simulation control).
    if (req.outcomeCategory === 'DEMO_REVIEW_RETURNED') {
      return reject('DEMO_REVIEW_RETURNED', 'LISTING_PUBLICATION_RETURNED_DEMO');
    }

    // Re-validate the §4.4 gate at resolve time.
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

    const publicId = listing.publicId ?? formatPublicId(randomBytes(6).toString('hex'));
    const photoIds = photos.map((p) => p.id);
    const compensate = async () => {
      await removePublicPhotos(photoIds.map((id) => publicPhotoKey(publicId, id)));
      await clearPublicPhotoPaths(listingId);
    };

    // --- Phase 1: prepare + verify public photos (service-role; compensable) ---
    try {
      for (let i = 0; i < photos.length; i++) {
        if (f.photoFailAt === i) throw new Error('injected photo-copy failure');
        const photo = photos[i]!;
        const key = publicPhotoKey(publicId, photo.id);
        await copyDraftPhotoToPublic(photo.storagePath, key, photo.contentType ?? undefined);
        await setPublicPhotoPath(photo.id, key);
      }
      if (!(await verifyPublicPhotos(publicId, photoIds))) throw new Error('public photo verification failed');
    } catch {
      await compensate();
      return reject('PHOTO_PROCESSING_FAILED', 'LISTING_PUBLIC_PHOTOS_FAILED');
    }
    await audit(tx, userId, 'LISTING_PUBLIC_PHOTOS_PREPARED', listingId, { count: photoIds.length });

    // --- Phase 2: ATOMIC database LIVE transition --------------------------------
    try {
      if (f.dbTxFail) throw new Error('injected database transition failure');
      const slug = await (async () => {
        const [property] = listing.propertyId ? await tx.select().from(properties).where(eq(properties.id, listing.propertyId)).limit(1) : [null];
        return buildListingSlug({
          bedrooms: property?.bedrooms ?? null,
          propertyType: property?.propertyType ?? null,
          community: property?.community ?? null,
          buildingOrProject: property?.buildingOrProject ?? null,
        });
      })();
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
    } catch {
      // Database transition failed AFTER Storage preparation → compensate and keep
      // the request PENDING (retryable). The listing is never left LIVE with
      // partial/missing public photos.
      await compensate();
      return req; // still PENDING
    }
  },

  /** Supersede a pending request after an invalidating edit (§5.2). */
  async supersedePending({ tx, listingId }: { tx: Tx; listingId: string }) {
    await tx
      .update(listingPublicationRequests)
      .set({ supersededAt: new Date() })
      .where(and(eq(listingPublicationRequests.listingId, listingId), eq(listingPublicationRequests.status, 'PENDING'), isNull(listingPublicationRequests.supersededAt)));
  },
};
