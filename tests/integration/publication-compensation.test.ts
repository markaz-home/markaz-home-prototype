import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { sql } from 'drizzle-orm';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  appRouter,
  createCallerFactory,
  PublicationReviewService,
  type Context,
} from '@markaz/api';
import { logger } from '@markaz/observability';
import { withUserContext, getAppDb, closeConnections } from '@markaz/db';
import {
  removePublicPhotos,
  clearPublicPhotoPaths,
  publicPhotoKey,
} from '@markaz/db/storage-admin';
import { resolveDemoIds, type DemoIds } from './helpers';

/**
 * Week 3 closure — publication is an IDEMPOTENT, COMPENSATED workflow. These tests
 * inject controlled faults (non-production) into the real service to prove the
 * Storage/PostgreSQL cleanup, retry, and idempotency semantics. Requires the live
 * stack + seed. Supabase Storage and PostgreSQL never share one transaction; the
 * DB LIVE transition alone is atomic.
 */
let ids: DemoIds | null = null;
let service: SupabaseClient | null = null;
const created: string[] = [];
const createCaller = createCallerFactory(appRouter);
const callerFor = (userId: string) =>
  createCaller({
    db: getAppDb(),
    user: { id: userId, accountType: 'CUSTOMER' },
    requestId: 'test',
    log: logger,
  } as Context);

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
const VALID_DETAILS = {
  propertyType: 'APARTMENT' as const,
  emirate: 'DUBAI' as const,
  community: 'Dubai Marina',
  buildingOrProject: 'Marina Gate 2',
  unitIdentifier: 'Unit 7001',
  bedrooms: 2,
  bathrooms: 2,
  sizeSqft: 1200,
  furnishingStatus: 'FURNISHED' as const,
  occupancyStatus: 'VACANT' as const,
  completionStatus: 'READY' as const,
  parkingSpaces: 1,
  description: 'C'.repeat(120),
  features: ['BALCONY' as const],
};

beforeAll(async () => {
  ids = await resolveDemoIds();
  if (!ids) return console.warn('[publication-compensation] Skipped — run `pnpm db:setup`.');
  service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
});
afterAll(async () => {
  if (ids) {
    const a = callerFor(ids.customerA);
    for (const id of created) await a.listing.delete({ listingId: id }).catch(() => {});
  }
  await closeConnections();
});

/** Drive a fresh listing to READY_TO_PUBLISH with `photoCount` real draft photos. */
async function driveToReady(ownerId: string, photoCount: number): Promise<string> {
  const a = callerFor(ownerId);
  const { listingId } = await a.listing.create();
  created.push(listingId);
  await a.listing.saveDetails({ listingId, ...VALID_DETAILS });
  await a.listing.document.register({
    listingId,
    documentType: 'TITLE_DEED',
    storagePath: `${ownerId}/${listingId}/doc.pdf`,
  });
  await a.listing.verification.start({ listingId });
  await a.listing.verification.status({ listingId });
  await a.listing.saveSettings({
    listingId,
    askingPriceAed: 1_800_000,
    minNotificationPriceAed: 1_600_000,
  });
  await a.listing.investment.skip({ listingId });
  await a.listing.formA.complete({ listingId, confirm: true });
  for (let i = 0; i < photoCount; i++) {
    const path = `${ownerId}/${listingId}/photo-${i}.png`;
    await service!.storage
      .from('listing-photos-draft')
      .upload(path, PNG, { contentType: 'image/png', upsert: true });
    await a.listing.photos.register({ listingId, storagePath: path, contentType: 'image/png' });
  }
  await a.listing.photos.complete({ listingId });
  await a.listing.permit.submit({ listingId, confirm: true });
  await a.listing.permit.status({ listingId });
  await a.listing.review.markReady({ listingId, confirm: true });
  return listingId;
}

const resolve = (listingId: string, inject?: { photoFailAt?: number; dbTxFail?: boolean }) =>
  withUserContext(getAppDb(), { userId: ids!.customerA, accountType: 'CUSTOMER' }, (tx) =>
    PublicationReviewService.resolve({ tx, userId: ids!.customerA, listingId }, inject),
  );
const submit = (listingId: string) =>
  withUserContext(getAppDb(), { userId: ids!.customerA, accountType: 'CUSTOMER' }, (tx) =>
    PublicationReviewService.submit({ tx, userId: ids!.customerA, listingId }),
  );

async function snapshot(listingId: string) {
  const db = getAppDb();
  const [l] = (await db.execute(
    sql`select state, public_id from public.listings where id = ${listingId}`,
  )) as unknown as Array<{ state: string; public_id: string | null }>;
  const photos = (await db.execute(
    sql`select public_path from public.property_photos where listing_id = ${listingId}`,
  )) as unknown as Array<{ public_path: string | null }>;
  const [r] = (await db.execute(
    sql`select status, outcome_category from public.listing_publication_requests where listing_id = ${listingId} and superseded_at is null order by created_at desc limit 1`,
  )) as unknown as Array<{ status: string; outcome_category: string | null }>;
  return {
    state: l?.state,
    publicId: l?.public_id,
    publicPaths: photos.map((p) => p.public_path),
    request: r,
  };
}
async function publicObjectCount(publicId: string): Promise<number> {
  const { data } = await service!.storage.from('listing-photos').list(publicId, { limit: 1000 });
  return data?.length ?? 0;
}

describe('publication compensation + idempotency', () => {
  it('Scenario A — a partial photo-copy failure cleans up and stays recoverable', async () => {
    if (!ids) return;
    const listingId = await driveToReady(ids.customerA, 2);
    await submit(listingId);
    await resolve(listingId, { photoFailAt: 1 }); // 2nd photo fails
    const s = await snapshot(listingId);
    expect(s.state).toBe('READY_TO_PUBLISH'); // never LIVE
    expect(s.publicPaths.every((p) => p === null)).toBe(true); // no staged public paths
    expect(s.request?.status).toBe('REJECTED_DEMO');
    expect(s.request?.outcome_category).toBe('PHOTO_PROCESSING_FAILED');
    expect(await publicObjectCount(s.publicId!)).toBe(0); // first copy removed
  });

  it('Scenario B — a database failure after photo copy compensates; retry then succeeds', async () => {
    if (!ids) return;
    const listingId = await driveToReady(ids.customerA, 2);
    await submit(listingId);
    await resolve(listingId, { dbTxFail: true });
    let s = await snapshot(listingId);
    expect(s.state).toBe('READY_TO_PUBLISH'); // not LIVE
    expect(s.publicPaths.every((p) => p === null)).toBe(true); // no stale public_path
    expect(await publicObjectCount(s.publicId!)).toBe(0); // objects cleaned up
    expect(s.request?.status).toBe('PENDING'); // retryable

    await resolve(listingId); // retry, no fault
    s = await snapshot(listingId);
    expect(s.state).toBe('LIVE');
    expect(s.publicPaths.every((p) => p !== null)).toBe(true);
    expect(await publicObjectCount(s.publicId!)).toBe(2);
  });

  it('Scenario C — retry after a partial failure copies once (no duplicate objects)', async () => {
    if (!ids) return;
    const listingId = await driveToReady(ids.customerA, 2);
    await submit(listingId);
    await resolve(listingId, { photoFailAt: 1 }); // fails → REJECTED
    await submit(listingId); // resubmit (supersede + new PENDING)
    const r = await resolve(listingId); // succeeds
    const s = await snapshot(listingId);
    expect(r?.status).toBe('APPROVED_DEMO');
    expect(s.state).toBe('LIVE');
    expect(await publicObjectCount(s.publicId!)).toBe(2); // exactly photo count — no dupes
  });

  it('Scenario D — a repeated resolve after success is a no-op (no duplicate photos/requests)', async () => {
    if (!ids) return;
    const listingId = await driveToReady(ids.customerA, 2);
    await submit(listingId);
    await resolve(listingId);
    const before = await snapshot(listingId);
    await resolve(listingId); // repeat
    await resolve(listingId); // repeat again
    const after = await snapshot(listingId);
    expect(after.state).toBe('LIVE');
    expect(await publicObjectCount(after.publicId!)).toBe(2);
    const reqCount = (await getAppDb().execute(
      sql`select count(*)::int as n from public.listing_publication_requests where listing_id = ${listingId} and superseded_at is null`,
    )) as unknown as Array<{ n: number }>;
    expect(Number(reqCount[0]?.n)).toBe(1); // one active request
    expect(after.publicId).toBe(before.publicId); // stable identity
  });

  it('Scenario E — repeated cleanup is safe and removes only the supplied keys', async () => {
    if (!ids) return;
    const listingId = await driveToReady(ids.customerA, 1);
    await submit(listingId);
    await resolve(listingId);
    const s = await snapshot(listingId);
    const photoRows = (await getAppDb().execute(
      sql`select id::text from public.property_photos where listing_id = ${listingId}`,
    )) as unknown as Array<{ id: string }>;
    const keys = photoRows.map((p) => publicPhotoKey(s.publicId!, p.id));
    // Cleanup twice — must not throw and must be idempotent.
    await removePublicPhotos(keys);
    await removePublicPhotos(keys);
    await clearPublicPhotoPaths(listingId);
    await clearPublicPhotoPaths(listingId);
    expect(await publicObjectCount(s.publicId!)).toBe(0);
    // An unrelated published listing's objects are untouched.
    const other = await service!.storage.from('listing-photos').list('demo/public', { limit: 10 });
    expect(other.data?.length ?? 0).toBeGreaterThan(0);
  });
});
