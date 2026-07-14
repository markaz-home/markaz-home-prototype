/**
 * Week-4 offer accessibility — axe scans (Playwright + @axe-core/playwright).
 * Fails on any critical or serious violation across the primary offer surfaces.
 *
 * Run with the full local stack + SUPABASE_SERVICE_ROLE_KEY (see offers.spec.ts).
 * Status: authored, pending a first validation pass on a healthy stack (WEEK-4.md §18).
 */
import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from '@playwright/test';
import { createCustomer, createLiveListing, teardown, type Customer } from './helpers/provision';
import { signIn, makeOffer, openFirstThread } from './helpers/flows';

const skip = !process.env.SUPABASE_SERVICE_ROLE_KEY;
test.describe.configure({ mode: 'serial' });

let seller: Customer;
let buyer: Customer;
let listing: { id: string; publicId: string; slug: string };

test.beforeAll(async () => {
  test.skip(skip, 'SUPABASE_SERVICE_ROLE_KEY not set — full stack required');
  seller = await createCustomer('a11y_seller');
  buyer = await createCustomer('a11y_buyer');
  listing = await createLiveListing(seller.id, { askingPrice: 2_000_000, minNotificationPrice: 1_800_000 });
});

test.afterAll(async () => {
  if (!skip) await teardown();
});

async function assertNoSeriousViolations(page: Page, label: string): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const serious = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
  if (serious.length) {
    console.error(`[axe:${label}]`, JSON.stringify(serious.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length })), null, 2));
  }
  expect(serious, `axe serious/critical violations on ${label}`).toEqual([]);
}

test('axe: buyer offer form', async ({ page }) => {
  test.skip(skip, 'full stack required');
  await signIn(page, buyer);
  await page.goto(`/en/properties/${listing.publicId}/${listing.slug}/offer`);
  await assertNoSeriousViolations(page, 'offer-form');
});

test('axe: buyer Offers hub', async ({ page }) => {
  test.skip(skip, 'full stack required');
  await signIn(page, buyer);
  await makeOffer(page, listing, 1_850_000);
  await page.goto('/en/offers?view=made');
  await assertNoSeriousViolations(page, 'buyer-offers');
});

test('axe: seller Offers inbox', async ({ page }) => {
  test.skip(skip, 'full stack required');
  await signIn(page, seller);
  await page.goto('/en/offers?view=received');
  await assertNoSeriousViolations(page, 'seller-inbox');
});

test('axe: offer thread + accept confirmation', async ({ page }) => {
  test.skip(skip, 'full stack required');
  await signIn(page, seller);
  await openFirstThread(page, 'received');
  await assertNoSeriousViolations(page, 'offer-thread');
  await page.getByRole('button', { name: 'Accept offer' }).click();
  await assertNoSeriousViolations(page, 'accept-confirmation');
});
