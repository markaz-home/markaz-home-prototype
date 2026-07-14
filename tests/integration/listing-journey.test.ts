import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { appRouter, createCallerFactory, type Context } from '@markaz/api';
import { logger } from '@markaz/observability';
import { getAppDb, closeConnections } from '@markaz/db';
import { resolveDemoIds, type DemoIds } from './helpers';

/**
 * Property-listing journey — backend integration (Week 2). Drives the real tRPC
 * router under each customer's RLS context against the live local stack.
 * Requires: pnpm supabase:start && pnpm supabase:reset && pnpm db:setup.
 */
let ids: DemoIds | null = null;
const createCaller = createCallerFactory(appRouter);

function callerFor(userId: string) {
  const ctx: Context = {
    db: getAppDb(),
    user: { id: userId, accountType: 'CUSTOMER' },
    requestId: 'test',
    log: logger,
  };
  return createCaller(ctx);
}

const VALID_DETAILS = {
  propertyType: 'APARTMENT' as const,
  emirate: 'DUBAI' as const,
  community: 'Dubai Marina',
  buildingOrProject: 'Marina Gate 2',
  unitIdentifier: 'Unit 2205',
  bedrooms: 2,
  bathrooms: 3,
  sizeSqft: 1284,
  furnishingStatus: 'FURNISHED' as const,
  occupancyStatus: 'VACANT' as const,
  completionStatus: 'READY' as const,
  parkingSpaces: 1,
  description: 'A'.repeat(120),
  features: ['BALCONY' as const, 'SEA_VIEW' as const],
};

const created: string[] = [];

beforeAll(async () => {
  ids = await resolveDemoIds();
  if (!ids) console.warn('[listing-journey] Skipped — run `pnpm db:setup`.');
});
afterAll(async () => {
  if (ids) {
    const a = callerFor(ids.customerA);
    for (const id of created)
      await a.listing.delete({ listingId: id, confirm: true } as never).catch(() => {});
  }
  await closeConnections();
});

async function drive(a: ReturnType<typeof callerFor>, listingId: string) {
  await a.listing.saveDetails({ listingId, ...VALID_DETAILS });
  await a.listing.document.register({
    listingId,
    documentType: 'TITLE_DEED',
    storagePath: `${listingId}/doc.pdf`,
    originalName: 'Fictional_Title_Deed.pdf',
    contentType: 'application/pdf',
    sizeBytes: 1024,
  });
  await a.listing.verification.start({ listingId });
  await a.listing.verification.status({ listingId });
  await a.listing.saveSettings({
    listingId,
    askingPriceAed: 2_100_000,
    minNotificationPriceAed: 1_950_000,
  });
  await a.listing.investment.save({
    listingId,
    originalPurchasePriceAed: 1_750_000,
    renovationCostsAed: 50_000,
    purchaseDate: '2022-06-29',
    visible: true,
  });
  await a.listing.formA.complete({ listingId, confirm: true });
  await a.listing.photos.register({
    listingId,
    storagePath: `${listingId}/p1.jpg`,
    originalName: 'p1.jpg',
    contentType: 'image/jpeg',
    sizeBytes: 2048,
  });
  await a.listing.photos.complete({ listingId });
  await a.listing.permit.submit({ listingId, confirm: true });
  await a.listing.permit.status({ listingId });
}

describe('listing journey (backend)', () => {
  it('a customer drives a draft all the way to READY_TO_PUBLISH', async () => {
    if (!ids) return;
    const a = callerFor(ids.customerA);
    const { listingId } = await a.listing.create();
    created.push(listingId);

    await drive(a, listingId);

    const review = await a.listing.review.status({ listingId });
    expect(review.ready).toBe(true);
    const done = await a.listing.review.markReady({ listingId, confirm: true });
    expect(done.state).toBe('READY_TO_PUBLISH');

    const final = await a.listing.get({ listingId });
    expect(final.state).toBe('READY_TO_PUBLISH');
    expect(final.permit.status).toBe('VERIFIED_DEMO');
  });

  it('another customer cannot read or mutate the draft (NOT_FOUND)', async () => {
    if (!ids) return;
    const a = callerFor(ids.customerA);
    const b = callerFor(ids.customerB);
    const { listingId } = await a.listing.create();
    created.push(listingId);
    await expect(b.listing.get({ listingId })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      b.listing.saveSettings({ listingId, askingPriceAed: 1, minNotificationPriceAed: 1 }),
    ).rejects.toBeTruthy();
  });

  it('server readiness blocks markReady until every required section is complete', async () => {
    if (!ids) return;
    const a = callerFor(ids.customerA);
    const { listingId } = await a.listing.create();
    created.push(listingId);
    await a.listing.saveDetails({ listingId, ...VALID_DETAILS });
    await expect(a.listing.review.markReady({ listingId, confirm: true })).rejects.toBeTruthy();
  });

  it('ownership verification supports failure then retry; permit too', async () => {
    if (!ids) return;
    const a = callerFor(ids.customerA);
    const { listingId } = await a.listing.create();
    created.push(listingId);
    await a.listing.saveDetails({ listingId, ...VALID_DETAILS });
    await a.listing.document.register({
      listingId,
      documentType: 'TITLE_DEED',
      storagePath: `${listingId}/d.pdf`,
    });
    await a.listing.verification.start({ listingId, demoOutcome: 'FAILURE' });
    const failed = await a.listing.verification.status({ listingId });
    expect(failed.status).toBe('FAILED_DEMO');
    await a.listing.verification.retry({ listingId, demoOutcome: 'SUCCESS' });
    const ok = await a.listing.verification.status({ listingId });
    expect(ok.status).toBe('VERIFIED_DEMO');
    // status is idempotent
    const again = await a.listing.verification.status({ listingId });
    expect(again.status).toBe('VERIFIED_DEMO');
  });

  it('the preview projection excludes private fields (unit id, occupancy, hidden IC)', async () => {
    if (!ids) return;
    const a = callerFor(ids.customerA);
    const { listingId } = await a.listing.create();
    created.push(listingId);
    await drive(a, listingId);
    // make the investment case private
    await a.listing.investment.setVisibility({ listingId, visible: false });
    const preview = await a.listing.preview({ listingId });
    expect(preview.isLive).toBe(false);
    expect(JSON.stringify(preview)).not.toContain('Unit 2205');
    expect((preview.property as Record<string, unknown>).occupancyStatus).toBeUndefined();
    expect(preview.investmentCase).toBeNull();
  });

  it('replacing the document resets verification and rewinds the listing', async () => {
    if (!ids) return;
    const a = callerFor(ids.customerA);
    const { listingId } = await a.listing.create();
    created.push(listingId);
    await a.listing.saveDetails({ listingId, ...VALID_DETAILS });
    await a.listing.document.register({
      listingId,
      documentType: 'TITLE_DEED',
      storagePath: `${listingId}/d1.pdf`,
    });
    await a.listing.verification.start({ listingId });
    await a.listing.verification.status({ listingId });
    let g = await a.listing.get({ listingId });
    expect(g.verification.status).toBe('VERIFIED_DEMO');
    // replace → verification reset, state back to DOCUMENT_UPLOADED
    await a.listing.document.register({
      listingId,
      documentType: 'OQOOD',
      storagePath: `${listingId}/d2.pdf`,
    });
    g = await a.listing.get({ listingId });
    expect(g.state).toBe('DOCUMENT_UPLOADED');
    expect(g.verification.status).toBe('NOT_STARTED');
  });
});
