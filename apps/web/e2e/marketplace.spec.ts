import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Week 3 customer marketplace end-to-end. Requires the stack + demo seed
 * (`pnpm supabase:reset && pnpm db:setup`) and the web app running. The seed
 * publishes three LIVE listings, one PAUSED listing, and Customer A's saved
 * properties (one available, one unavailable). Demo password from setup-demo.
 */
const DEMO_EMAIL = 'customer-a@markaz.demo';
const DEMO_PASSWORD = 'Markaz!Demo1';

async function signIn(page: Page) {
  await page.goto('/en/sign-in');
  await page.getByLabel(/email/i).fill(DEMO_EMAIL);
  await page
    .getByLabel(/password/i)
    .first()
    .fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await page.waitForURL(/\/en\/(dashboard|properties|saved-properties)/, { timeout: 15000 });
}

test.describe('public marketplace', () => {
  test('anonymous visitor can browse, filter, and open a property', async ({ page }) => {
    await page.goto('/en/properties');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Properties/i);
    await expect(page.getByText(/Prototype marketplace/i)).toBeVisible();

    // Seeded LIVE listings appear.
    const cards = page.locator('a[href*="/properties/mkz-"]');
    await expect(cards.first()).toBeVisible({ timeout: 15000 });
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);

    // Open the first property detail.
    await cards.first().click();
    await page.waitForURL(/\/en\/properties\/mkz-/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText(/About this property|Property details/i).first()).toBeVisible();
  });

  test('anonymous Save opens the sign-in interception dialog', async ({ page }) => {
    await page.goto('/en/properties');
    const card = page.locator('a[href*="/properties/mkz-"]').first();
    await expect(card).toBeVisible({ timeout: 15000 });
    await card.click();
    await page.waitForURL(/\/en\/properties\/mkz-/);

    await page
      .getByRole('button', { name: /save property/i })
      .first()
      .click();
    await expect(page.getByText(/Sign in to save this property/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /create account/i })).toBeVisible();
  });

  test('browse page has no critical accessibility violations', async ({ page }) => {
    await page.goto('/en/properties');
    await expect(page.locator('a[href*="/properties/mkz-"]').first()).toBeVisible({
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
    await signIn(page);
    await page.goto('/en/saved-properties');
    await expect(page.getByRole('heading', { level: 1, name: /saved properties/i })).toBeVisible();
    // Seeded: one available card (JBR) + one unavailable stub (paused Hills).
    await expect(page.locator('a[href*="/properties/mkz-"]').first()).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText(/no longer available/i).first()).toBeVisible();
  });
});
