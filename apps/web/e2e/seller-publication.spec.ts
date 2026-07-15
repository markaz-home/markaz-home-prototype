/**
 * Week 3 seller publication end-to-end. Self-provisions its data (no demo seed): one
 * customer who owns a publishable READY listing, a returned-for-changes READY listing, a
 * photo-processing-failure READY listing, a LIVE listing (pause/resume), and a second LIVE
 * listing that keeps the marketplace non-empty. Requires the full local stack
 * (SUPABASE_SERVICE_ROLE_KEY set) + the web app running.
 */
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {
  createCustomer,
  createListing,
  createPublishableListing,
  createPublicationRequest,
  makePublishable,
  addPhotos,
  teardown,
  type Customer,
} from './helpers/provision';
import { signIn } from './helpers/flows';

const skip = !process.env.SUPABASE_SERVICE_ROLE_KEY;

let customer: Customer;
let readyL: { id: string };
let returnedL: { id: string };
let photoFailL: { id: string; publicId: string | null };
let liveL: { id: string; publicId: string | null; slug: string | null };
let browseLive: { id: string; publicId: string | null };

test.beforeAll(async () => {
  test.skip(skip, 'SUPABASE_SERVICE_ROLE_KEY not set — full stack required');
  customer = await createCustomer('pub');

  // Publishable READY listing (records + real draft photos) → publish to LIVE.
  readyL = await createPublishableListing(customer.id, { title: 'E2E Publish Me' });

  // Publishable READY listing that was "returned for changes" → retry republishes to LIVE.
  returnedL = await createPublishableListing(customer.id, { title: 'E2E Returned' });
  await createPublicationRequest(returnedL.id, customer.id, 'DEMO_REVIEW_RETURNED');

  // READY listing with a photo-processing failure (screen-only; no retry driven).
  photoFailL = await createListing(customer.id, {
    state: 'READY_TO_PUBLISH',
    title: 'E2E Photo Fail',
    askingPrice: 2_100_000,
    minNotificationPrice: 1_950_000,
  });
  await createPublicationRequest(photoFailL.id, customer.id, 'PHOTO_PROCESSING_FAILED');

  // LIVE listing for pause/resume. Resume re-checks publication eligibility, so it needs the
  // full set of records (ownership/verification/Form A/permit) plus a public cover photo.
  liveL = await createListing(customer.id, {
    state: 'LIVE',
    title: 'E2E Pause Me',
    askingPrice: 2_100_000,
    minNotificationPrice: 1_950_000,
  });
  await makePublishable(liveL.id, customer.id, { photos: 0 });
  await addPhotos(liveL.id, liveL.publicId, 1);

  // A second LIVE listing to keep the marketplace non-empty while liveL is paused.
  browseLive = await createListing(customer.id, { state: 'LIVE', title: 'E2E Always Live' });
  await addPhotos(browseLive.id, browseLive.publicId, 1);
});

test.afterAll(async () => {
  if (!skip) await teardown();
});

test('publish a READY listing through review to LIVE and open its public page', async ({
  page,
}) => {
  await signIn(page, customer);
  await page.goto(`/en/sell/listings/${readyL.id}/publish`);
  await expect(page.getByRole('heading', { name: /Publication checklist/i })).toBeVisible();
  await page.getByRole('button', { name: /Continue to confirmation/i }).click();
  await expect(page.getByText(/Publication review simulated/i)).toBeVisible();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: /Submit for publication/i }).click();

  await page.waitForURL(new RegExp(`/sell/listings/${readyL.id}/publication`));
  await expect(page.getByRole('heading', { name: /Your listing is live/i })).toBeVisible({
    timeout: 20000,
  });
  await page.getByRole('link', { name: /View live listing/i }).click();
  await page.waitForURL(/\/en\/properties\//);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('returned-for-changes shows a safe reason and retry republishes to LIVE', async ({ page }) => {
  await signIn(page, customer);
  await page.goto(`/en/sell/listings/${returnedL.id}/publication`);
  await expect(
    page.getByRole('heading', { name: /Review your listing before resubmitting/i }),
  ).toBeVisible();
  await expect(page.getByText(/Changes required/i)).toBeVisible();
  await page.getByRole('button', { name: /Try publication again/i }).click();
  await expect(page.getByRole('heading', { name: /Your listing is live/i })).toBeVisible({
    timeout: 20000,
  });
});

test('a public-photo processing failure is actionable and keeps the listing private', async ({
  page,
}) => {
  await signIn(page, customer);
  await page.goto(`/en/sell/listings/${photoFailL.id}/publication`);
  await expect(page.getByText(/could not prepare all property photographs/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /Try publication again/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /Review photographs/i })).toBeVisible();
});

test('publication checklist page has no critical accessibility violations', async ({ page }) => {
  await signIn(page, customer);
  await page.goto(`/en/sell/listings/${photoFailL.id}/publish`);
  await expect(page.getByRole('heading', { name: /Publication checklist/i })).toBeVisible();
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const serious = r.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
  expect(serious, JSON.stringify(serious.map((v) => v.id))).toEqual([]);
});

test.describe('pause and resume a live listing', () => {
  test.describe.configure({ mode: 'serial' });

  test('owner pauses the listing', async ({ page }) => {
    await signIn(page, customer);
    await page.goto(`/en/sell/listings/${liveL.id}/manage`);
    await expect(page.getByText('LIVE', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: /Pause listing/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText(/Pause this listing\?/i)).toBeVisible();
    await dialog.getByRole('button', { name: /Pause listing/i }).click();
    await expect(page.getByText(/This listing is paused/i)).toBeVisible({ timeout: 15000 });
  });

  test('paused listing is gone from the marketplace, then resume restores it', async ({ page }) => {
    await page.goto('/en/properties');
    await expect(page.locator(`a[href*="/properties/${browseLive.publicId}"]`).first()).toBeVisible(
      { timeout: 15000 },
    );
    await expect(page.locator(`a[href*="/properties/${liveL.publicId}"]`)).toHaveCount(0);

    await signIn(page, customer);
    await page.goto(`/en/sell/listings/${liveL.id}/manage`);
    await page.getByRole('button', { name: /Resume listing/i }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: /Resume listing/i }).click();
    await expect(page.getByText('LIVE', { exact: true })).toBeVisible({ timeout: 15000 });
  });

  test('live management page has no critical accessibility violations', async ({ page }) => {
    await signIn(page, customer);
    await page.goto(`/en/sell/listings/${liveL.id}/manage`);
    await expect(page.getByText('LIVE', { exact: true })).toBeVisible();
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const serious = r.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    expect(serious, JSON.stringify(serious.map((v) => v.id))).toEqual([]);
  });
});
