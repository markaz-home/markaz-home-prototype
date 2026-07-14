/**
 * Week-5 transaction accessibility — axe scans (fail on serious/critical).
 * Run with the full local stack + SUPABASE_SERVICE_ROLE_KEY.
 */
import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from '@playwright/test';
import {
  createCustomer,
  createLiveListing,
  acceptedTransaction,
  driveToDeposit,
  driveToDocuments,
  driveToCompletion,
  teardown,
  type Customer,
} from './helpers/provision';
import { signIn } from './helpers/flows';

const skip = !process.env.SUPABASE_SERVICE_ROLE_KEY;
test.describe.configure({ mode: 'serial' });

let seller: Customer;
let buyer: Customer;

test.beforeAll(async () => {
  test.skip(skip, 'SUPABASE_SERVICE_ROLE_KEY not set — full stack required');
  seller = await createCustomer('txa_seller');
  buyer = await createCustomer('txa_buyer');
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

test('axe: My Transactions', async ({ page }) => {
  test.skip(skip, 'full stack required');
  const listingId = (await createLiveListing(seller.id, { askingPrice: 2_000_000 })).id;
  await acceptedTransaction(buyer.id, seller.id, listingId);
  await signIn(page, buyer);
  await page.goto('/en/transactions');
  await assertNoSeriousViolations(page, 'my-transactions');
});

test('axe: transaction workspace (early stage)', async ({ page }) => {
  test.skip(skip, 'full stack required');
  const listingId = (await createLiveListing(seller.id, { askingPrice: 2_000_000 })).id;
  const txId = await acceptedTransaction(buyer.id, seller.id, listingId);
  await signIn(page, buyer);
  await page.goto(`/en/transactions/${txId}`);
  await assertNoSeriousViolations(page, 'workspace-early');
});

test('axe: deposit simulation', async ({ page }) => {
  test.skip(skip, 'full stack required');
  const listingId = (await createLiveListing(seller.id, { askingPrice: 2_000_000 })).id;
  const txId = await acceptedTransaction(buyer.id, seller.id, listingId);
  await driveToDeposit(txId, buyer.id, seller.id);
  await signIn(page, buyer);
  await page.goto(`/en/transactions/${txId}`);
  await assertNoSeriousViolations(page, 'deposit');
});

test('axe: document checklist', async ({ page }) => {
  test.skip(skip, 'full stack required');
  const listingId = (await createLiveListing(seller.id, { askingPrice: 2_000_000 })).id;
  const txId = await acceptedTransaction(buyer.id, seller.id, listingId);
  await driveToDocuments(txId, buyer.id, seller.id);
  await signIn(page, buyer);
  await page.goto(`/en/transactions/${txId}`);
  await assertNoSeriousViolations(page, 'documents');
});

test('axe: transaction workspace (completion stage)', async ({ page }) => {
  test.skip(skip, 'full stack required');
  const listingId = (await createLiveListing(seller.id, { askingPrice: 2_000_000 })).id;
  const txId = await acceptedTransaction(buyer.id, seller.id, listingId);
  await driveToCompletion(txId, buyer.id, seller.id);
  await signIn(page, buyer);
  await page.goto(`/en/transactions/${txId}`);
  await assertNoSeriousViolations(page, 'workspace-completion');
});
