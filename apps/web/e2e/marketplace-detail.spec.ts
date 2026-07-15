import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// SKIPPED — assumes the removed demo seed (fixed demo creds + mkz-* publicIds).
// Honestly skipped (visible in the report), not vacuously green. Port to
// self-provision via helpers/provision.ts — see FOLLOWUP-selfprovision.md.
test.beforeEach(() => {
  test.skip(true, 'pending self-provision rewrite — see e2e/FOLLOWUP-selfprovision.md');
});

/**
 * Week 3 public property detail, gallery, Investment Case, owner treatment,
 * Arabic/RTL and mobile coverage. Read-only against the seed (distinct listings),
 * safe in parallel. Requires the stack + seed + running web app.
 */
const DEMO_EMAIL = 'customer-a@markaz.demo';
const DEMO_PASSWORD = 'Markaz!Demo1';
const IC_VISIBLE = 'mkz-demojbr01'; // JBR, 2 photos, Investment Case visible
const IC_HIDDEN = 'mkz-demodtn01'; // Downtown, owned by Customer A, no Investment Case

async function signIn(page: Page) {
  await page.goto('/en/sign-in');
  await page.getByLabel(/email/i).fill(DEMO_EMAIL);
  await page
    .getByLabel(/password/i)
    .first()
    .fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await page.waitForURL(/\/en\/(dashboard|properties)/, { timeout: 15000 });
}

async function openDetail(page: Page, publicId: string, locale = 'en') {
  await page.goto(`/${locale}/properties/${publicId}/x`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15000 });
}

test('detail page shows facts, gallery, and a visible Investment Case with disclosure', async ({
  page,
}) => {
  await openDetail(page, IC_VISIBLE);
  await expect(page.getByRole('heading', { name: /Investment Case/i })).toBeVisible();
  await expect(page.getByText(/Estimated ROI/i)).toBeVisible();
  await expect(page.getByText(/estimates, not financial advice/i)).toBeVisible();
  await expect(page.getByRole('heading', { name: /About this property/i })).toBeVisible();
});

test('a hidden Investment Case never appears on the public page', async ({ page }) => {
  await openDetail(page, IC_HIDDEN);
  await expect(page.getByRole('heading', { name: /^Investment Case$/i })).toHaveCount(0);
});

test('gallery opens and is keyboard-navigable (arrows + escape)', async ({ page }) => {
  await openDetail(page, IC_VISIBLE);
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
  await signIn(page);
  await openDetail(page, IC_HIDDEN); // Customer A owns this listing
  await expect(page.getByText(/Your listing/i)).toBeVisible();
  await expect(page.getByRole('link', { name: /Manage listing/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Save property$/i })).toHaveCount(0);
});

test('detail page has no critical accessibility violations', async ({ page }) => {
  await openDetail(page, IC_VISIBLE);
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const serious = r.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
  expect(serious, JSON.stringify(serious.map((v) => v.id))).toEqual([]);
});

test('saved properties page has no critical accessibility violations', async ({ page }) => {
  await signIn(page);
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
  await expect(page.locator('a[href*="/properties/mkz-"]').first()).toBeVisible({ timeout: 15000 });
  await openDetail(page, IC_VISIBLE, 'ar');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
});

test('mobile marketplace and detail work on a small viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/en/properties');
  const card = page.locator('a[href*="/properties/mkz-"]').first();
  await expect(card).toBeVisible({ timeout: 15000 });
  await card.click();
  await page.waitForURL(/\/en\/properties\/mkz-/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: /Save property/i }).first()).toBeVisible();
});
