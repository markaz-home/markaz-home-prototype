/**
 * Week 3 public property detail, gallery, Investment Case, owner treatment,
 * Arabic/RTL and mobile coverage. Self-provisions (no demo seed): one customer who
 * owns an IC-visible LIVE listing (2 photos + a visible investment case) and an
 * IC-hidden LIVE listing (no investment case). Requires the full local stack
 * (SUPABASE_SERVICE_ROLE_KEY set) and the web app running.
 */
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {
  createCustomer,
  createListing,
  addPhotos,
  addInvestmentCase,
  saveListing,
  teardown,
  type Customer,
} from './helpers/provision';
import { signIn } from './helpers/flows';

const skip = !process.env.SUPABASE_SERVICE_ROLE_KEY;

let owner: Customer;
let icVisible: { id: string; publicId: string | null; slug: string | null };
let icHidden: { id: string; publicId: string | null; slug: string | null };

test.beforeAll(async () => {
  test.skip(skip, 'SUPABASE_SERVICE_ROLE_KEY not set — full stack required');
  owner = await createCustomer('detail-owner');

  icVisible = await createListing(owner.id, { state: 'LIVE', title: 'E2E JBR IC-Visible' });
  await addPhotos(icVisible.id, icVisible.publicId, 2);
  await addInvestmentCase(icVisible.id, { visible: true, estimatedRoiPct: 12.5 });

  icHidden = await createListing(owner.id, { state: 'LIVE', title: 'E2E Downtown IC-Hidden' });
  await addPhotos(icHidden.id, icHidden.publicId, 1);

  // A saved listing so the Saved page renders a card for the axe check.
  await saveListing(owner.id, icVisible.id);
});

test.afterAll(async () => {
  if (!skip) await teardown();
});

async function openDetail(page: Page, publicId: string, slug: string, locale = 'en') {
  await page.goto(`/${locale}/properties/${publicId}/${slug}`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15000 });
}

test('detail page shows facts, gallery, and a visible Investment Case with disclosure', async ({
  page,
}) => {
  await openDetail(page, icVisible.publicId!, icVisible.slug!);
  await expect(page.getByRole('heading', { name: /Investment Case/i })).toBeVisible();
  await expect(page.getByText(/Estimated ROI/i)).toBeVisible();
  await expect(page.getByText(/estimates, not financial advice/i)).toBeVisible();
  await expect(page.getByRole('heading', { name: /About this property/i })).toBeVisible();
});

test('a hidden Investment Case never appears on the public page', async ({ page }) => {
  await openDetail(page, icHidden.publicId!, icHidden.slug!);
  await expect(page.getByRole('heading', { name: /^Investment Case$/i })).toHaveCount(0);
});

test('gallery opens and is keyboard-navigable (arrows + escape)', async ({ page }) => {
  await openDetail(page, icVisible.publicId!, icVisible.slug!);
  await page.getByRole('button', { name: /View all \d+ photos/i }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('1 of 2')).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(dialog.getByText('2 of 2')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('owner viewing their own public listing sees Your listing + Manage, not Save', async ({
  page,
}) => {
  await signIn(page, owner);
  await openDetail(page, icHidden.publicId!, icHidden.slug!); // owner owns this listing
  await expect(page.getByText(/Your listing/i)).toBeVisible();
  await expect(page.getByRole('link', { name: /Manage listing/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Save property$/i })).toHaveCount(0);
});

test('detail page has no critical accessibility violations', async ({ page }) => {
  await openDetail(page, icVisible.publicId!, icVisible.slug!);
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const serious = r.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
  expect(serious, JSON.stringify(serious.map((v) => v.id))).toEqual([]);
});

test('saved properties page has no critical accessibility violations', async ({ page }) => {
  await signIn(page, owner);
  await page.goto('/en/saved-properties');
  await expect(page.getByRole('heading', { level: 1, name: /saved properties/i })).toBeVisible();
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const serious = r.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
  expect(serious, JSON.stringify(serious.map((v) => v.id))).toEqual([]);
});

test('Arabic marketplace and property detail render right-to-left', async ({ page }) => {
  await page.goto('/ar/properties');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator(`a[href*="/properties/${icVisible.publicId}"]`).first()).toBeVisible({
    timeout: 15000,
  });
  await openDetail(page, icVisible.publicId!, icVisible.slug!, 'ar');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
});

test('mobile marketplace and detail work on a small viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/en/properties');
  const card = page.locator(`a[href*="/properties/${icVisible.publicId}"]`).first();
  await expect(card).toBeVisible({ timeout: 15000 });
  await card.click();
  await page.waitForURL(new RegExp(`/en/properties/${icVisible.publicId}`));
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: /Save property/i }).first()).toBeVisible();
});
