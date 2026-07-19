/**
 * Property-listing journey E2E (Week 2). Drives the full wizard in a real browser and
 * self-provisions its accounts + listings (no demo seed): a customer who owns a
 * READY_TO_PUBLISH listing, a second customer who owns a DRAFT (for the cross-owner
 * check), and a fresh customer for the end-to-end wizard. Sims default to SUCCESS.
 * Requires the full local stack (SUPABASE_SERVICE_ROLE_KEY set) + the web app running.
 */
import { test, expect } from '@playwright/test';
import { createCustomer, createListing, teardown, type Customer } from './helpers/provision';
import { signIn } from './helpers/flows';

const skip = !process.env.SUPABASE_SERVICE_ROLE_KEY;
const WIZARD_NAVIGATION_TIMEOUT_MS = 20_000;

let customer: Customer;
let wizardCustomer: Customer;
let otherDraft: { id: string };

test.beforeAll(async () => {
  test.skip(skip, 'SUPABASE_SERVICE_ROLE_KEY not set — full stack required');
  customer = await createCustomer('lj');
  wizardCustomer = await createCustomer('lj-wizard');
  // A ready-to-publish listing so "My listings" shows the "Ready to publish" chip.
  await createListing(customer.id, { state: 'READY_TO_PUBLISH', title: 'E2E Ready Listing' });
  const other = await createCustomer('lj-other');
  otherDraft = await createListing(other.id, { state: 'DRAFT', title: 'E2E Other Draft' });
});

test.afterAll(async () => {
  if (!skip) await teardown();
});

const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

test.describe('listing journey', () => {
  test('My Listings shows a ready-to-publish listing for the customer', async ({ page }) => {
    await signIn(page, customer);
    await page.goto('/en/sell');
    await expect(page.getByRole('heading', { name: 'My listings' })).toBeVisible();
    await expect(page.getByText('Ready to publish').first()).toBeVisible();
  });

  test('a customer completes a new listing end-to-end to READY_TO_PUBLISH', async ({ page }) => {
    test.slow();
    await signIn(page, wizardCustomer);
    await page.goto('/en/sell');
    await page.getByRole('button', { name: 'Create new listing' }).click();
    await expect(page).toHaveURL(/\/sell\/listings\/.+\/details/, {
      timeout: WIZARD_NAVIGATION_TIMEOUT_MS,
    });

    // Property Details
    await page.getByRole('button', { name: 'Apartment', exact: true }).click();
    await page.getByLabel('Area or community').fill('Dubai Marina');
    await page.getByLabel('Building or project').fill('Marina Gate 2');
    await page.getByLabel(/Unit or property identifier/).fill('Unit 3010');
    await page.locator('#bedrooms').selectOption('2');
    await page.locator('#bathrooms').selectOption('2');
    await page.getByLabel('Property size').fill('1200');
    await page.locator('#furnishing').selectOption('FURNISHED');
    await page.locator('#occupancy').selectOption('VACANT');
    await page.locator('#completion').selectOption('READY');
    await page.getByLabel('Property description').fill('A'.repeat(120));
    await page.getByRole('button', { name: 'Save and continue' }).click();
    await expect(page).toHaveURL(/\/ownership/, { timeout: WIZARD_NAVIGATION_TIMEOUT_MS });

    // Ownership document (fictional sample)
    await page.locator('input[type=file]').setInputFiles({
      name: 'fictional-title-deed.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 fictional sample'),
    });
    await expect(page.getByText('Uploaded privately')).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: 'Save and continue' }).click();
    await expect(page).toHaveURL(/\/verification/, { timeout: WIZARD_NAVIGATION_TIMEOUT_MS });

    // Simulated ownership verification → verified
    await page.getByRole('button', { name: 'Start simulated check' }).click();
    await page
      .getByRole('button', { name: 'Continue to listing settings' })
      .click({ timeout: 20000 });
    await expect(page).toHaveURL(/\/settings/, { timeout: WIZARD_NAVIGATION_TIMEOUT_MS });

    // Settings
    await page.getByLabel('Asking price').fill('2100000');
    await page.getByLabel('Minimum offer notification').fill('1950000');
    await page.getByRole('button', { name: 'Save and continue' }).click();
    await expect(page).toHaveURL(/\/investment-case/, {
      timeout: WIZARD_NAVIGATION_TIMEOUT_MS,
    });

    // Skip the optional Investment Case
    await page.getByRole('button', { name: 'Skip for now' }).first().click();
    await expect(page).toHaveURL(/\/form-a/, { timeout: WIZARD_NAVIGATION_TIMEOUT_MS });

    // Simulated Form A
    await page.getByText('I confirm the demo listing details above.').click();
    await page.getByRole('button', { name: 'Complete simulated Form A' }).click();
    await expect(page).toHaveURL(/\/photos/, { timeout: WIZARD_NAVIGATION_TIMEOUT_MS });

    // Photos
    await page
      .locator('input[type=file]')
      .setInputFiles({ name: 'cover.png', mimeType: 'image/png', buffer: PNG_1x1 });
    await expect(page.getByText('· Cover photograph')).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: 'Save and continue' }).click();
    await expect(page).toHaveURL(/\/trakheesi/, { timeout: WIZARD_NAVIGATION_TIMEOUT_MS });

    // Simulated Trakheesi → approved
    await page.getByText('I confirm the demo listing information is ready').click();
    await page.getByRole('button', { name: 'Submit simulated application' }).click();
    await page.getByRole('button', { name: 'Review listing' }).click({ timeout: 20000 });
    await expect(page).toHaveURL(/\/review/, { timeout: WIZARD_NAVIGATION_TIMEOUT_MS });

    // Review → mark ready
    await page.getByText('I have reviewed the listing and understand').click();
    await page.getByRole('button', { name: 'Mark listing ready' }).click();
    await expect(page).toHaveURL(/\/ready/, { timeout: WIZARD_NAVIGATION_TIMEOUT_MS });
    await expect(
      page.getByRole('heading', { name: /Your listing setup is complete/i }),
    ).toBeVisible();
  });

  test("a customer cannot access another customer's draft (safe not-available)", async ({
    page,
  }) => {
    await signIn(page, customer);
    await page.goto(`/en/sell/listings/${otherDraft.id}/details`);
    await expect(page.getByText('This listing is not available')).toBeVisible({ timeout: 15000 });
  });
});
