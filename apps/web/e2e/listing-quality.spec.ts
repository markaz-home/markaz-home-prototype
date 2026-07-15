/**
 * Listing-journey quality gates (Week 2): axe accessibility on the major listing
 * screens, plus Arabic-RTL and mobile-viewport checks. Self-provisions its data (no
 * demo seed): a customer who owns a DRAFT, an OWNERSHIP_REVIEW, and a READY_TO_PUBLISH
 * listing (the READY one has two photos for the photo-ordering controls). Requires the
 * full local stack (SUPABASE_SERVICE_ROLE_KEY set) + the web app running.
 */
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {
  createCustomer,
  createListing,
  addPhotos,
  teardown,
  type Customer,
} from './helpers/provision';
import { signIn } from './helpers/flows';

const skip = !process.env.SUPABASE_SERVICE_ROLE_KEY;

let customer: Customer;
let incomplete: { id: string }; // DRAFT (details)
let pending: { id: string }; // OWNERSHIP_REVIEW
let ready: { id: string }; // READY_TO_PUBLISH (2 photos)

test.beforeAll(async () => {
  test.skip(skip, 'SUPABASE_SERVICE_ROLE_KEY not set — full stack required');
  customer = await createCustomer('lq');
  incomplete = await createListing(customer.id, { state: 'DRAFT', title: 'E2E Draft' });
  pending = await createListing(customer.id, { state: 'OWNERSHIP_REVIEW', title: 'E2E In Review' });
  ready = await createListing(customer.id, { state: 'READY_TO_PUBLISH', title: 'E2E Ready' });
  await addPhotos(ready.id, null, 2);
});

test.afterAll(async () => {
  if (!skip) await teardown();
});

async function axeSerious(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  return results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
}

test.describe('listing accessibility (axe) on major screens', () => {
  test('screens have no serious/critical axe violations', async ({ page }) => {
    await signIn(page, customer);
    const screens: [string, string][] = [
      ['Property Details', `/en/sell/listings/${incomplete.id}/details`],
      ['Ownership Document', `/en/sell/listings/${pending.id}/ownership`],
      ['Property Photos', `/en/sell/listings/${ready.id}/photos`],
      ['Review', `/en/sell/listings/${ready.id}/review`],
      ['Ready to Publish', `/en/sell/listings/${ready.id}/ready`],
    ];
    for (const [, url] of screens) {
      await page.goto(url);
      await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 15000 });
      const serious = await axeSerious(page);
      expect(
        serious,
        `${url}: ${JSON.stringify(serious.map((v) => ({ id: v.id, nodes: v.nodes.length })))}`,
      ).toEqual([]);
    }
  });
});

test.describe('listing localisation & responsive', () => {
  test('Arabic RTL renders a listing step (stepper, currency, controls)', async ({ page }) => {
    await signIn(page, customer);
    await page.goto(`/ar/sell/listings/${ready.id}/settings`);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByRole('heading', { name: 'حدّد سعرك وتفضيل العروض' })).toBeVisible({
      timeout: 15000,
    });
    // AED currency fields render with LTR numeric inputs inside the RTL page.
    await expect(page.locator('#asking')).toHaveAttribute('dir', 'ltr');
    await expect(page.getByText('AED').first()).toBeVisible();
  });

  test('mobile viewport shows the step progress and action bar', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page, customer);
    await page.goto(`/en/sell/listings/${incomplete.id}/details`);
    await expect(page.getByText('Step 1 of 9', { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: 'Save and continue' })).toBeVisible();
    // A core control is usable on mobile.
    await expect(page.getByLabel('Area or community')).toBeVisible();
  });

  test('photo ordering controls are keyboard-operable (non-drag alternative)', async ({ page }) => {
    await signIn(page, customer);
    await page.goto(`/en/sell/listings/${ready.id}/photos`);
    // The ready listing has 2 photos; the move/cover controls are real buttons.
    await expect(page.getByRole('button', { name: 'Move later' }).first()).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByRole('button', { name: 'Set as cover' }).first()).toBeVisible();
  });
});
