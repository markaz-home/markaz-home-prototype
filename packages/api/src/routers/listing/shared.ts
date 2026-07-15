/**
 * Shared helpers for the listing router family. The listing router is split by
 * workflow step (document / verification / investment / formA / photos / permit /
 * review / publication) into sibling files that all build on these primitives:
 * owner-scoped loads, the server-authoritative progress snapshot, downstream
 * invalidation, and the simulation status mapping. The public `listing.*` tRPC
 * shape is composed in `./index`.
 */
import { and, desc, eq, isNull } from 'drizzle-orm';
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
  auditEvents,
  type Tx,
} from '@markaz/db';
import { propertyDetailsSchema, canRewindListing, type ListingProgressInput } from '@markaz/domain';

export const demoOutcome = z.enum(['SUCCESS', 'FAILURE']).optional();

export function num(v: string | null): number | null {
  return v === null ? null : Number(v);
}

export async function audit(
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
export async function loadOwned(tx: Tx, listingId: string) {
  const [row] = await tx.select().from(listings).where(eq(listings.id, listingId)).limit(1);
  if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'This listing is not available.' });
  return row;
}

export async function loadActiveDoc(tx: Tx, listingId: string) {
  const [d] = await tx
    .select()
    .from(ownershipDocuments)
    .where(and(eq(ownershipDocuments.listingId, listingId), eq(ownershipDocuments.active, true)))
    .limit(1);
  return d ?? null;
}
export async function latest<T extends { createdAt: Date }>(rows: T[]): Promise<T | null> {
  return rows[0] ?? null;
}
export async function activeVerification(tx: Tx, listingId: string) {
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
export async function activeFormA(tx: Tx, listingId: string) {
  const rows = await tx
    .select()
    .from(formARecords)
    .where(and(eq(formARecords.listingId, listingId), isNull(formARecords.supersededAt)))
    .orderBy(desc(formARecords.createdAt))
    .limit(1);
  return latest(rows);
}
export async function activePermit(tx: Tx, listingId: string) {
  const rows = await tx
    .select()
    .from(permitRecords)
    .where(and(eq(permitRecords.listingId, listingId), isNull(permitRecords.supersededAt)))
    .orderBy(desc(permitRecords.createdAt))
    .limit(1);
  return latest(rows);
}

export function isDetailsComplete(
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

export const SIM = {
  VERIFIED_DEMO: 'VERIFIED_DEMO',
  FAILED_DEMO: 'FAILED_DEMO',
  PENDING: 'PENDING',
} as const;

/** Build the server-authoritative progress snapshot for the domain readiness logic. */
export async function buildSnapshot(tx: Tx, listingId: string) {
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
export async function invalidateDownstream(
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
