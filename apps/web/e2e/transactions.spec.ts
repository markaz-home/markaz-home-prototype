/**
 * Week-5 transaction workspace — E2E (Playwright), full local stack.
 * Provisions an accepted offer + transaction via SQL, then drives the workspace UI.
 * Run: SUPABASE_SERVICE_ROLE_KEY=<local secret> pnpm --filter @markaz/web test:e2e
 */
import { test, expect } from '@playwright/test';
import {
  createCustomer,
  createLiveListing,
  acceptedTransaction,
  driveToDocuments,
  driveToCompletion,
  teardown,
  type Customer,
} from './helpers/provision';
import { signIn } from './helpers/flows';

const skip = !process.env.SUPABASE_SERVICE_ROLE_KEY;

let seller: Customer;
let buyer: Customer;
let outsider: Customer;

test.beforeAll(async () => {
  test.skip(skip, 'SUPABASE_SERVICE_ROLE_KEY not set — full stack required');
  seller = await createCustomer('tx_seller');
  buyer = await createCustomer('tx_buyer');
  outsider = await createCustomer('tx_outsider');
});

test.afterAll(async () => {
  if (!skip) await teardown();
});

test('buyer confirms transaction details from the workspace', async ({ page }) => {
  test.skip(skip, 'full stack required');
  const listingId = (await createLiveListing(seller.id, { askingPrice: 2_000_000 })).id;
  const txId = await acceptedTransaction(buyer.id, seller.id, listingId);
  await signIn(page, buyer);
  await page.goto(`/en/transactions/${txId}`);
  await expect(page.getByText(/Stage 1 of 6/)).toBeVisible();

  await page.getByRole('checkbox').first().check();
  await page.getByRole('button', { name: 'Confirm transaction details' }).click();
  // The confirm-details control disappears once the task is complete.
  await expect(page.getByRole('button', { name: 'Confirm transaction details' })).toHaveCount(0);
});

test('transaction document uploads stay private to each uploader and can be removed', async ({
  browser,
}) => {
  test.skip(skip, 'full stack required');
  const listingId = (await createLiveListing(seller.id, { askingPrice: 2_000_000 })).id;
  const txId = await acceptedTransaction(buyer.id, seller.id, listingId);
  await driveToDocuments(txId, buyer.id, seller.id);

  const buyerContext = await browser.newContext();
  const buyerPage = await buyerContext.newPage();
  await signIn(buyerPage, buyer);
  await buyerPage.goto(`/en/transactions/${txId}`);
  await buyerPage.getByLabel('Buyer identity document').setInputFiles({
    name: 'fictional-buyer-id.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n% MARKAZ fictional UAT file\n'),
  });
  await expect(buyerPage.getByText('fictional-buyer-id.pdf')).toBeVisible();
  await expect(buyerPage.getByText('Accepted in demo')).toBeVisible();

  const sellerContext = await browser.newContext();
  const sellerPage = await sellerContext.newPage();
  await signIn(sellerPage, seller);
  await sellerPage.goto(`/en/transactions/${txId}`);
  await expect(sellerPage.getByText('fictional-buyer-id.pdf')).toHaveCount(0);
  await sellerPage.getByLabel('Seller identity document').setInputFiles({
    name: 'fictional-seller-id.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n% MARKAZ fictional seller UAT file\n'),
  });
  await expect(sellerPage.getByText('fictional-seller-id.pdf')).toBeVisible();
  await expect(buyerPage.getByText('fictional-seller-id.pdf')).toHaveCount(0);

  await buyerPage.getByRole('button', { name: 'Remove' }).click();
  await expect(buyerPage.getByText('fictional-buyer-id.pdf')).toHaveCount(0);
  await sellerPage.getByRole('button', { name: 'Remove' }).click();
  await expect(sellerPage.getByText('fictional-seller-id.pdf')).toHaveCount(0);

  await sellerContext.close();
  await buyerContext.close();
});

test('mobile Arabic transaction document flow remains usable without page overflow', async ({
  page,
}) => {
  test.skip(skip, 'full stack required');
  await page.setViewportSize({ width: 390, height: 844 });
  const listingId = (await createLiveListing(seller.id, { askingPrice: 2_000_000 })).id;
  const txId = await acceptedTransaction(buyer.id, seller.id, listingId);
  await driveToDocuments(txId, buyer.id, seller.id);
  await signIn(page, buyer);
  await page.goto(`/ar/transactions/${txId}`);

  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('main')).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  ).toBe(true);

  await page.getByLabel('مستند هوية المشتري').setInputFiles({
    name: 'fictional-mobile-id.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n% MARKAZ fictional mobile UAT file\n'),
  });
  await expect(page.getByText('fictional-mobile-id.pdf')).toBeVisible();

  await page.setViewportSize({ width: 844, height: 390 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  ).toBe(true);
  await page.getByRole('button', { name: 'إزالة' }).click();
});

test('both participants confirm completion → Transaction completed in demo', async ({
  browser,
}) => {
  test.skip(skip, 'full stack required');
  const listingId = (await createLiveListing(seller.id, { askingPrice: 2_000_000 })).id;
  const txId = await acceptedTransaction(buyer.id, seller.id, listingId);
  await driveToCompletion(txId, buyer.id, seller.id);

  const bp = await (await browser.newContext()).newPage();
  await signIn(bp, buyer);
  await bp.goto(`/en/transactions/${txId}`);
  await bp.getByRole('checkbox').first().check();
  await bp.getByRole('button', { name: 'Confirm completion in demo' }).click();
  await expect(bp.getByRole('button', { name: 'Confirm completion in demo' })).toHaveCount(0);

  const sp = await (await browser.newContext()).newPage();
  await signIn(sp, seller);
  await sp.goto(`/en/transactions/${txId}`);
  await sp.getByRole('checkbox').first().check();
  await sp.getByRole('button', { name: 'Confirm completion in demo' }).click();
  await expect(sp.getByText('Transaction completed in demo')).toBeVisible();
});

test('buyer can cancel an early transaction (listing paused)', async ({ page }) => {
  test.skip(skip, 'full stack required');
  const listingId = (await createLiveListing(seller.id, { askingPrice: 2_000_000 })).id;
  const txId = await acceptedTransaction(buyer.id, seller.id, listingId);
  await signIn(page, buyer);
  await page.goto(`/en/transactions/${txId}`);
  await page.getByRole('button', { name: 'Request cancellation' }).first().click();
  // Dialog: confirm the request (default reason).
  await page.getByRole('button', { name: 'Request cancellation' }).last().click();
  await expect(page.getByText('Transaction cancelled')).toBeVisible();
});

test('an unrelated customer cannot open the transaction', async ({ page }) => {
  test.skip(skip, 'full stack required');
  const listingId = (await createLiveListing(seller.id, { askingPrice: 2_000_000 })).id;
  const txId = await acceptedTransaction(buyer.id, seller.id, listingId);
  await signIn(page, outsider);
  await page.goto(`/en/transactions/${txId}`);
  await expect(page.getByText('This transaction is not available')).toBeVisible();
});

test('My Transactions lists the buyer transaction', async ({ page }) => {
  test.skip(skip, 'full stack required');
  const listingId = (await createLiveListing(seller.id, { askingPrice: 2_000_000 })).id;
  await acceptedTransaction(buyer.id, seller.id, listingId);
  await signIn(page, buyer);
  await page.goto('/en/transactions');
  await expect(page.getByText('You are buying').first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'View transaction' }).first()).toBeVisible();
});
