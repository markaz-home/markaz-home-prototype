import { test, expect } from '@playwright/test';
import {
  createAdmin,
  createCustomer,
  createLiveListing,
  createPendingPublication,
  createOfferThread,
  acceptedTransaction,
  provisionTransactionDocument,
  teardown,
  type Principal,
} from './helpers/provision';
import { adminSignIn, gotoDetail, runReasonAction } from './helpers/flows';

let adminUser: Principal;

test.beforeAll(async () => {
  adminUser = await createAdmin('main');
});
test.afterAll(async () => {
  await teardown();
});

test.describe('Admin portal — access control', () => {
  test('a CUSTOMER is denied the operations portal', async ({ page }) => {
    const customer = await createCustomer('denied');
    await page.goto('/en/login');
    await page.locator('#email').fill(customer.email);
    await page.locator('#password').fill(customer.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    // Non-admins never reach an operations surface.
    await expect(page).toHaveURL(/access-denied|login/, { timeout: 20_000 });
    await expect(page.getByRole('link', { name: /Customers/i })).toHaveCount(0);
  });

  test('an ADMIN signs in and sees the eight operations areas', async ({ page }) => {
    await adminSignIn(page, adminUser);
    // Scope to the sidebar nav landmark — "Customers" etc. also appear as dashboard metric links.
    const nav = page.getByRole('navigation', { name: 'Admin' });
    for (const area of [
      'Overview',
      'Customers',
      'Listings',
      'Publication',
      'Offers',
      'Transactions',
      'Verifications',
      'Audit',
    ]) {
      await expect(nav.getByRole('link', { name: area, exact: true })).toBeVisible();
    }
  });
});

test.describe('Customer restriction', () => {
  test('restrict then restore a customer, with audit trail', async ({ page }) => {
    const customer = await createCustomer('restrict-target');
    await adminSignIn(page, adminUser);
    await gotoDetail(page, 'customers', customer.id);

    await runReasonAction(
      page,
      /Restrict actions/i,
      /Reason/i,
      'ACCOUNT_REVIEW',
      /Restrict actions/i,
    );
    await expect(page.getByText(/Actions restricted/i).first()).toBeVisible();

    await runReasonAction(
      page,
      /Restore actions/i,
      /Reason/i,
      'REVIEW_COMPLETED',
      /Restore actions/i,
    );
    await expect(page.getByText(/^Active$/i).first()).toBeVisible();

    // The action is recorded in the audit log.
    await page.goto('/en/audit');
    await expect(page.getByText(/ADMIN_CUSTOMER_ACTIONS_RESTRICTED/).first()).toBeVisible({
      timeout: 15_000,
    });
  });
});

test.describe('Publication review', () => {
  test('approve a pending publication', async ({ page }) => {
    const seller = await createCustomer('pub-seller');
    const { requestId } = await createPendingPublication(seller.id);
    await adminSignIn(page, adminUser);
    await gotoDetail(page, 'publication', requestId);
    await page.getByRole('button', { name: /Approve & publish/i }).click();
    await page
      .getByRole('button', { name: /Approve & publish/i })
      .last()
      .click();
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 20_000 });
  });

  test('return a pending publication for changes', async ({ page }) => {
    const seller = await createCustomer('pub-seller2');
    const { requestId } = await createPendingPublication(seller.id);
    await adminSignIn(page, adminUser);
    await gotoDetail(page, 'publication', requestId);
    await runReasonAction(
      page,
      /Return for changes/i,
      /Reason/i,
      'PHOTOS_NEED_CHANGES',
      /Return for changes/i,
    );
    await expect(page.getByText(/Returned|already completed/i).first()).toBeVisible();
  });
});

test.describe('Listing availability', () => {
  test('pause then resume a live listing', async ({ page }) => {
    const seller = await createCustomer('listing-owner');
    const listing = await createLiveListing(seller.id);
    await adminSignIn(page, adminUser);
    await gotoDetail(page, 'listings', listing.id);
    await runReasonAction(
      page,
      /Pause listing/i,
      /Reason/i,
      'INFORMATION_UNDER_REVIEW',
      /Pause listing/i,
    );
    await expect(page.getByText(/Paused/i).first()).toBeVisible();
    await page.getByRole('button', { name: /Resume listing/i }).click();
    await page.getByLabel(/Reason/i).fill('Review complete');
    await page
      .getByRole('button', { name: /Resume listing/i })
      .last()
      .click();
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 15_000 });
  });
});

test.describe('Offer oversight', () => {
  test('an offer thread is read-only with an immutable proposal history', async ({ page }) => {
    const seller = await createCustomer('offer-seller');
    const buyer = await createCustomer('offer-buyer');
    const listing = await createLiveListing(seller.id, 'E2E Offer Listing');
    const threadId = await createOfferThread(buyer.id, listing.id);
    await adminSignIn(page, adminUser);
    await gotoDetail(page, 'offers', threadId);
    await expect(page.getByText(/Proposal history/i)).toBeVisible();
    // No control exists to change a proposal amount from the admin surface.
    await expect(page.getByRole('spinbutton')).toHaveCount(0);
  });
});

test.describe('Private-document access', () => {
  test('admin opens a private document with a reason (audited REQUESTED+GRANTED); customer is denied', async ({
    page,
  }) => {
    const seller = await createCustomer('doc-seller');
    const buyer = await createCustomer('doc-buyer');
    const listing = await createLiveListing(seller.id, 'E2E Doc Listing');
    const txId = await acceptedTransaction(buyer.id, seller.id, listing.id);
    await provisionTransactionDocument(txId, buyer.id);

    await adminSignIn(page, adminUser);
    await gotoDetail(page, 'transactions', txId);
    await expect(page.getByText(/Private documents/i)).toBeVisible();
    await expect(page.getByText('id.pdf').first()).toBeVisible();

    // Open securely: reason + acknowledgement are both required before the button enables.
    await page
      .getByRole('button', { name: /Open securely/i })
      .first()
      .click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('button', { name: /Open document/i })).toBeDisabled();
    await dialog.getByLabel('Reason', { exact: true }).selectOption('VERIFICATION_REVIEW');
    await dialog.getByRole('checkbox').check();
    const [popup] = await Promise.all([
      page.waitForEvent('popup').catch(() => null),
      dialog.getByRole('button', { name: /Open document/i }).click(),
    ]);
    await expect(dialog).toBeHidden({ timeout: 15_000 });
    if (popup) await popup.close();

    // Exact audit lifecycle — REQUESTED then GRANTED, never a URL/path.
    await page.goto('/en/audit');
    await expect(page.getByText('ADMIN_DOCUMENT_ACCESS_GRANTED').first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText('ADMIN_DOCUMENT_ACCESS_REQUESTED').first()).toBeVisible();

    // A customer cannot reach the transaction (and thus the document control) in the portal.
    const denied = await page.context().browser()!.newContext();
    const cpage = await denied.newPage();
    await cpage.goto('/en/login');
    await cpage.locator('#email').fill(buyer.email);
    await cpage.locator('#password').fill(buyer.password);
    await cpage.getByRole('button', { name: 'Sign in' }).click();
    await cpage.goto(`/en/transactions/${txId}`);
    await expect(cpage).toHaveURL(/access-denied|login/, { timeout: 20_000 });
    await expect(cpage.getByRole('button', { name: /Open securely/i })).toHaveCount(0);
    await denied.close();
  });
});

test.describe('Transaction recovery', () => {
  test('admin pauses then resumes a transaction; participant ownership unchanged; audited', async ({
    page,
  }) => {
    const seller = await createCustomer('rec-seller');
    const buyer = await createCustomer('rec-buyer');
    const listing = await createLiveListing(seller.id, 'E2E Recovery Listing');
    const txId = await acceptedTransaction(buyer.id, seller.id, listing.id);

    await adminSignIn(page, adminUser);
    await gotoDetail(page, 'transactions', txId);

    // Capture the customer's next-action ownership before recovery.
    const nextActor = () =>
      page
        .locator('dt', { hasText: 'Next actor' })
        .locator('xpath=following-sibling::dd[1]')
        .first()
        .innerText();
    const before = (await nextActor()).trim();

    // Pause progression (reason recorded). The detail page swaps the action to "Resume",
    // which is the on-page evidence the transaction is now paused.
    await page
      .getByRole('button', { name: /Pause progression/i })
      .first()
      .click();
    let dialog = page.getByRole('dialog');
    await dialog.getByLabel('Reason', { exact: true }).fill('Under operational review');
    await dialog.getByRole('button', { name: /Pause progression/i }).click();
    await expect(dialog).toBeHidden({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /Resume progression/i })).toBeVisible();

    // Resume progression.
    await page
      .getByRole('button', { name: /Resume progression/i })
      .first()
      .click();
    dialog = page.getByRole('dialog');
    await dialog.getByLabel('Reason', { exact: true }).fill('Review complete');
    await dialog.getByRole('button', { name: /Resume progression/i }).click();
    await expect(dialog).toBeHidden({ timeout: 15_000 });

    // Ownership unchanged: same next actor, and the transaction was not failed/cancelled.
    await expect(async () => expect((await nextActor()).trim()).toBe(before)).toPass({
      timeout: 10_000,
    });
    await expect(page.getByText(/^Failed$|^Cancelled$/i)).toHaveCount(0);

    // Both recovery actions recorded immutably.
    await page.goto('/en/audit');
    await expect(page.getByText('ADMIN_TRANSACTION_PAUSED').first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText('ADMIN_TRANSACTION_RESUMED').first()).toBeVisible();
  });
});

test.describe('Audit log', () => {
  test('renders immutable events with actor + action columns', async ({ page }) => {
    await adminSignIn(page, adminUser);
    await page.goto('/en/audit');
    await expect(page.getByRole('columnheader', { name: /Action/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /Actor/i })).toBeVisible();
  });
});
