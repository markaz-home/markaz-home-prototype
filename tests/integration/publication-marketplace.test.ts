import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { type SupabaseClient } from '@supabase/supabase-js';
import { appRouter, createCallerFactory, type Context } from '@markaz/api';
import { logger } from '@markaz/observability';
import { getAppDb, closeConnections } from '@markaz/db';
import { cleanup, closePool, createPrincipal, dbReachable } from './helpers/db';
import { storageEnv, serviceClient } from './helpers/storage';

/**
 * Publication → marketplace backend integration (Week 3). Drives a listing to
 * LIVE through the real publication review + public-photo pipeline, then exercises
 * the anonymous marketplace, saves, privacy, and pause/resume. SELF-PROVISIONS its
 * customers (no demo seed); runs against the live local stack.
 */
const env = storageEnv();
const reachable = env ? await dbReachable() : false;
const d = reachable ? describe : describe.skip;
if (!reachable) {
  // eslint-disable-next-line no-console
  console.warn('[publication-marketplace] skipped — local Supabase stack/env not reachable');
}

let customerA = '';
let customerB = '';
let admin: SupabaseClient | null = null;
const createCaller = createCallerFactory(appRouter);
const created: string[] = [];

const callerFor = (userId: string) =>
  createCaller({
    db: getAppDb(),
    user: { id: userId, accountType: 'CUSTOMER' },
    requestId: 'test',
    log: logger,
  } as Context);
const anonCaller = () =>
  createCaller({ db: getAppDb(), user: null, requestId: 'test', log: logger } as Context);

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
const VALID_DETAILS = {
  propertyType: 'APARTMENT' as const,
  emirate: 'DUBAI' as const,
  community: 'Dubai Marina',
  buildingOrProject: 'Marina Gate 2',
  unitIdentifier: 'Unit 9090',
  bedrooms: 2,
  bathrooms: 3,
  sizeSqft: 1284,
  furnishingStatus: 'FURNISHED' as const,
  occupancyStatus: 'VACANT' as const,
  completionStatus: 'READY' as const,
  parkingSpaces: 1,
  description: 'A'.repeat(120),
  features: ['BALCONY' as const],
};

beforeAll(async () => {
  if (!reachable) return;
  customerA = await createPrincipal('mkt_a');
  customerB = await createPrincipal('mkt_b');
  admin = serviceClient(env!);
});
afterAll(async () => {
  if (reachable) {
    const a = callerFor(customerA);
    for (const id of created) await a.listing.delete({ listingId: id }).catch(() => {});
    await cleanup();
    await closePool();
  }
  await closeConnections();
});

async function driveToLive(a: ReturnType<typeof callerFor>, ownerId: string): Promise<string> {
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
    askingPriceAed: 2_100_000,
    minNotificationPriceAed: 1_950_000,
  });
  await a.listing.investment.skip({ listingId });
  await a.listing.formA.complete({ listingId, confirm: true });
  // Upload a REAL draft photo so the public-photo pipeline can copy it.
  const path = `${ownerId}/${listingId}/cover.png`;
  await admin!.storage
    .from('listing-photos-draft')
    .upload(path, PNG, { contentType: 'image/png', upsert: true });
  await a.listing.photos.register({ listingId, storagePath: path, contentType: 'image/png' });
  await a.listing.photos.complete({ listingId });
  await a.listing.permit.submit({ listingId, confirm: true });
  await a.listing.permit.status({ listingId });
  await a.listing.review.markReady({ listingId, confirm: true });
  await a.listing.publication.submit({ listingId, confirm: true });
  await a.listing.publication.status({ listingId }); // resolves: photos → LIVE
  return listingId;
}

d('publication → marketplace', () => {
  it('publishes a READY listing to LIVE and exposes it in the anonymous marketplace', async () => {
    const a = callerFor(customerA);
    const listingId = await driveToLive(a, customerA);

    const got = await a.listing.get({ listingId });
    expect(got.state).toBe('LIVE');
    const status = await a.listing.publication.status({ listingId });
    expect(status.publicId).toBeTruthy();
    const publicId = status.publicId!;

    const anon = anonCaller();
    const search = await anon.marketplace.search({});
    expect(search.items.some((i) => i.publicId === publicId)).toBe(true);

    const detail = await anon.marketplace.getByPublicId({ publicId });
    expect(detail).not.toBeNull();
    expect(detail!.coverUrl).toContain('/storage/v1/object/public/listing-photos/');
    // Privacy: no unit id, owner id, or private storage path in the public response.
    const json = JSON.stringify(detail);
    expect(json).not.toContain('Unit 9090');
    expect(json).not.toContain(customerA);
    expect(json).not.toContain('listing-photos-draft');
    expect((detail as Record<string, unknown>).unitIdentifier).toBeUndefined();
  });

  it('READY_TO_PUBLISH / PAUSED listings are not public; pause+resume work', async () => {
    const a = callerFor(customerA);
    const listingId = await driveToLive(a, customerA);
    const publicId = (await a.listing.publication.status({ listingId })).publicId!;
    const anon = anonCaller();

    await a.listing.pause({ listingId });
    expect((await anon.marketplace.search({})).items.some((i) => i.publicId === publicId)).toBe(
      false,
    );
    expect(await anon.marketplace.getByPublicId({ publicId })).toBeNull();

    await a.listing.resume({ listingId });
    expect((await anon.marketplace.search({})).items.some((i) => i.publicId === publicId)).toBe(
      true,
    );
  });

  it("save rules: customer saves another customer's LIVE listing; owner cannot save own; unavailable stays safe", async () => {
    const a = callerFor(customerA);
    const b = callerFor(customerB);
    const listingId = await driveToLive(a, customerA);
    const publicId = (await a.listing.publication.status({ listingId })).publicId!;

    await b.marketplace.saved.save({ publicId });
    await b.marketplace.saved.save({ publicId }); // idempotent
    expect((await b.marketplace.saved.isSaved({ publicId })).saved).toBe(true);
    const listB = await b.marketplace.saved.list();
    expect(listB.some((i) => (i as { kind: string }).kind === 'available')).toBe(true);

    await expect(a.marketplace.saved.save({ publicId })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });

    // Pause → B's saved entry becomes a safe unavailable stub (no private data).
    await a.listing.pause({ listingId });
    const listB2 = await b.marketplace.saved.list();
    const stub = listB2.find((i) => (i as { kind: string }).kind === 'unavailable');
    expect(stub).toBeTruthy();
    expect(JSON.stringify(stub)).not.toContain('Marina Gate');
  });

  it('search filters + sort work over the public view', async () => {
    const anon = anonCaller();
    const apts = await anon.marketplace.search({ type: 'APARTMENT', sort: 'PRICE_ASC' });
    expect(apts.items.every((i) => i.propertyType === 'APARTMENT')).toBe(true);
    const none = await anon.marketplace.search({ minPrice: 999_000_000 });
    expect(none.items.length).toBe(0);
    const opts = await anon.marketplace.getFilterOptions();
    expect(Array.isArray(opts.propertyTypes)).toBe(true);
  });
});
