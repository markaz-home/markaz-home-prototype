/**
 * Week 3 customer marketplace end-to-end. Self-provisions its data (no demo seed):
 * a seller with three listings (a LIVE one to browse, a saved LIVE one, and a saved
 * PAUSED one), plus a signed-in customer who saved the latter two. Requires the full
 * local stack (SUPABASE_SERVICE_ROLE_KEY set) and the web app running.
 */
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {
  createCustomer,
  createListing,
  addPhotos,
  saveListing,
  teardown,
  type Customer,
} from './helpers/provision';
import { signIn } from './helpers/flows';

const skip = !process.env.SUPABASE_SERVICE_ROLE_KEY;

let seller: Customer;
let customer: Customer;
let live: { id: string; publicId: string | null; slug: string | null };
let savedLive: { id: string; publicId: string | null; slug: string | null };

test.beforeAll(async () => {
  test.skip(skip, 'SUPABASE_SERVICE_ROLE_KEY not set — full stack required');
  seller = await createCustomer('mkt-seller');
  customer = await createCustomer('mkt-buyer');

  live = await createListing(seller.id, { state: 'LIVE', title: 'E2E Browse Marina Villa' });
  await addPhotos(live.id, live.publicId, 1);

  savedLive = await createListing(seller.id, { state: 'LIVE', title: 'E2E Saved JBR' });
  await addPhotos(savedLive.id, savedLive.publicId, 1);
  await saveListing(customer.id, savedLive.id);

  // A saved-then-paused listing surfaces as an "unavailable" stub in Saved.
  const paused = await createListing(seller.id, { state: 'PAUSED', title: 'E2E Saved Hills' });
  await saveListing(customer.id, paused.id);
});

test.afterAll(async () => {
  if (!skip) await teardown();
});

test.describe('public marketplace', () => {
  test('anonymous visitor can browse, filter, and open a property', async ({ page }) => {
    await page.goto('/en/properties');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Properties/i);
    await expect(page.getByText(/Prototype marketplace/i)).toBeVisible();

    // The provisioned LIVE listing appears and opens its detail page.
    const card = page.locator(`a[href*="/properties/${live.publicId}"]`).first();
    await expect(card).toBeVisible({ timeout: 15000 });
    await card.click();
    await page.waitForURL(new RegExp(`/en/properties/${live.publicId}`));
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText(/About this property|Property details/i).first()).toBeVisible();
  });

  test('anonymous Save opens the sign-in interception dialog', async ({ page }) => {
    await page.goto(`/en/properties/${live.publicId}/${live.slug}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15000 });

    await page
      .getByRole('button', { name: /save property/i })
      .first()
      .click();
    await expect(page.getByText(/Sign in to save this property/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /create account/i })).toBeVisible();
  });

  test('browse page has no critical accessibility violations', async ({ page }) => {
    await page.goto('/en/properties');
    await expect(page.locator(`a[href*="/properties/${live.publicId}"]`).first()).toBeVisible({
      timeout: 15000,
    });
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const serious = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
    expect(serious, JSON.stringify(serious.map((v) => v.id))).toEqual([]);
  });
});

test.describe('authenticated saved properties', () => {
  test('shows available and unavailable saved listings', async ({ page }) => {
    await signIn(page, customer);
    await page.goto('/en/saved-properties');
    await expect(page.getByRole('heading', { level: 1, name: /saved properties/i })).toBeVisible();
    // One available card (saved LIVE) + one unavailable stub (saved then paused).
    await expect(page.locator(`a[href*="/properties/${savedLive.publicId}"]`).first()).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText(/no longer available/i).first()).toBeVisible();
  });
});
