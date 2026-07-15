// SKIPPED — assumes the removed demo seed (fixed demo creds + mkz-* publicIds).
// Honestly skipped (test.describe.skip), not vacuously green. Port to self-provision
// via helpers/provision.ts — see FOLLOWUP-selfprovision.md.
import { test, expect, type Page } from '@playwright/test';

/**
 * Property-listing journey E2E (Week 2). Drives the full wizard in a real browser
 * against the local stack + demo accounts. Requires: pnpm supabase:start &&
 * supabase:reset && db:setup, and both apps running. Sims default to SUCCESS.
 */
const PASSWORD = 'Markaz!Demo1';
const B_DRAFT = '00000000-0000-0000-0000-0000000021b1'; // seeded Customer B draft

async function signIn(page: Page, email: string) {
  await page.goto('/en/sign-in');
  await page.getByLabel(/Email address/i).fill(email);
  await page.getByLabel(/^Password/).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/en\/dashboard/);
}

const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

test.describe.skip('listing journey', () => {
  test('My Listings shows seeded drafts for Customer A', async ({ page }) => {
    await signIn(page, 'customer-a@markaz.demo');
    await page.goto('/en/sell');
    await expect(page.getByRole('heading', { name: 'My listings' })).toBeVisible();
    await expect(page.getByText('Ready to publish').first()).toBeVisible();
  });

  test('a customer completes a new listing end-to-end to READY_TO_PUBLISH', async ({ page }) => {
    test.slow();
    await signIn(page, 'customer-a@markaz.demo');
    await page.goto('/en/sell');
    await page.getByRole('button', { name: 'Create new listing' }).click();
    await expect(page).toHaveURL(/\/sell\/listings\/.+\/details/);

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
    await expect(page).toHaveURL(/\/ownership/);

    // Ownership document (fictional sample)
    await page.locator('input[type=file]').setInputFiles({
      name: 'fictional-title-deed.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 fictional sample'),
    });
    await expect(page.getByText('Uploaded privately')).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: 'Save and continue' }).click();
    await expect(page).toHaveURL(/\/verification/);

    // Simulated ownership verification → verified
    await page.getByRole('button', { name: 'Start simulated check' }).click();
    await page
      .getByRole('button', { name: 'Continue to listing settings' })
      .click({ timeout: 20000 });
    await expect(page).toHaveURL(/\/settings/);

    // Settings
    await page.getByLabel('Asking price').fill('2100000');
    await page.getByLabel('Minimum offer notification').fill('1950000');
    await page.getByRole('button', { name: 'Save and continue' }).click();
    await expect(page).toHaveURL(/\/investment-case/);

    // Skip the optional Investment Case
    await page.getByRole('button', { name: 'Skip for now' }).first().click();
    await expect(page).toHaveURL(/\/form-a/);

    // Simulated Form A
    await page.getByText('I confirm the demo listing details above.').click();
    await page.getByRole('button', { name: 'Complete simulated Form A' }).click();
    await expect(page).toHaveURL(/\/photos/, { timeout: 20000 });

    // Photos
    await page
      .locator('input[type=file]')
      .setInputFiles({ name: 'cover.png', mimeType: 'image/png', buffer: PNG_1x1 });
    await expect(page.getByText('· Cover photograph')).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: 'Save and continue' }).click();
    await expect(page).toHaveURL(/\/trakheesi/);

    // Simulated Trakheesi → approved
    await page.getByText('I confirm the demo listing information is ready').click();
    await page.getByRole('button', { name: 'Submit simulated application' }).click();
    await page.getByRole('button', { name: 'Review listing' }).click({ timeout: 20000 });
    await expect(page).toHaveURL(/\/review/);

    // Review → mark ready
    await page.getByText('I have reviewed the listing and understand').click();
    await page.getByRole('button', { name: 'Mark listing ready' }).click();
    await expect(page).toHaveURL(/\/ready/);
    await expect(page.getByRole('heading', { name: 'Your listing is ready' })).toBeVisible();
  });

  test("a customer cannot access another customer's draft (safe not-available)", async ({
    page,
  }) => {
    // Customer A (whose password is never mutated by other specs) tries to open
    // Customer B's seeded draft → safe not-available (RLS + server ownership).
    await signIn(page, 'customer-a@markaz.demo');
    await page.goto(`/en/sell/listings/${B_DRAFT}/details`);
    await expect(page.getByText('This listing is not available')).toBeVisible({ timeout: 15000 });
  });
});
