import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Listing-journey quality gates (Week 2): axe accessibility on the major listing
 * screens, plus Arabic-RTL and mobile-viewport checks. Uses seeded listings as
 * Customer A (whose password is never mutated by other specs).
 */
const PASSWORD = 'Markaz!Demo1';
const INCOMPLETE = '00000000-0000-0000-0000-0000000021a1'; // DRAFT (details)
const PENDING = '00000000-0000-0000-0000-0000000021a2'; // OWNERSHIP_REVIEW
const READY = '00000000-0000-0000-0000-0000000021a3'; // READY_TO_PUBLISH

async function signInA(page: Page) {
  await page.goto('/en/sign-in');
  await page.getByLabel(/Email address/i).fill('customer-a@markaz.demo');
  await page.getByLabel(/^Password/).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/en\/dashboard/);
}

async function axeSerious(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  return results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
}

test.describe('listing accessibility (axe) on major screens', () => {
  const screens: [string, string][] = [
    ['Property Details', `/en/sell/listings/${INCOMPLETE}/details`],
    ['Ownership Document', `/en/sell/listings/${PENDING}/ownership`],
    ['Property Photos', `/en/sell/listings/${READY}/photos`],
    ['Review', `/en/sell/listings/${READY}/review`],
    ['Ready to Publish', `/en/sell/listings/${READY}/ready`],
  ];
  for (const [name, url] of screens) {
    test(`${name} has no serious/critical axe violations`, async ({ page }) => {
      await signInA(page);
      await page.goto(url);
      await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 15000 });
      const serious = await axeSerious(page);
      expect(serious, JSON.stringify(serious.map((v) => ({ id: v.id, nodes: v.nodes.length })), null, 2)).toEqual([]);
    });
  }
});

test.describe('listing localisation & responsive', () => {
  test('Arabic RTL renders a listing step (stepper, currency, controls)', async ({ page }) => {
    await signInA(page);
    await page.goto(`/ar/sell/listings/${READY}/settings`);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByRole('heading', { name: 'حدّد سعرك وتفضيل العروض' })).toBeVisible({ timeout: 15000 });
    // AED currency fields render with LTR numeric inputs inside the RTL page.
    await expect(page.locator('#asking')).toHaveAttribute('dir', 'ltr');
    await expect(page.getByText('AED').first()).toBeVisible();
  });

  test('mobile viewport shows the step progress and action bar', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signInA(page);
    await page.goto(`/en/sell/listings/${INCOMPLETE}/details`);
    await expect(page.getByText('Step 1 of 9', { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: 'Save and continue' })).toBeVisible();
    // A core control is usable on mobile.
    await expect(page.getByLabel('Area or community')).toBeVisible();
  });

  test('photo ordering controls are keyboard-operable (non-drag alternative)', async ({ page }) => {
    await signInA(page);
    await page.goto(`/en/sell/listings/${READY}/photos`);
    // Seeded ready listing has 2 photos; the move/cover controls are real buttons.
    await expect(page.getByRole('button', { name: 'Move later' }).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: 'Set as cover' }).first()).toBeVisible();
  });
});
