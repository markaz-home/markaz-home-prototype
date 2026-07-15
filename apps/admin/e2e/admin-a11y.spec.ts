/**
 * Week-6 admin accessibility — axe scans (Playwright + @axe-core/playwright).
 * Fails on any critical or serious violation across the five primary operations surfaces:
 * dashboard, customer profile, publication review, transaction detail, audit log.
 *
 * Run with the full local stack + SUPABASE_SERVICE_ROLE_KEY (see admin.spec.ts).
 * Status: authored, pending a first validation pass on a healthy stack (WEEK-6.md).
 */
import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from '@playwright/test';
import {
  createAdmin,
  createCustomer,
  createPendingPublication,
  teardown,
  type Principal,
} from './helpers/provision';
import { adminSignIn } from './helpers/flows';

const skip = !process.env.SUPABASE_SERVICE_ROLE_KEY;
test.describe.configure({ mode: 'serial' });

let adminUser: Principal;
let customer: Principal;
let publicationRequestId: string;

test.beforeAll(async () => {
  test.skip(skip, 'SUPABASE_SERVICE_ROLE_KEY not set — full stack required');
  adminUser = await createAdmin('a11y');
  customer = await createCustomer('a11y_customer');
  const seller = await createCustomer('a11y_seller');
  ({ requestId: publicationRequestId } = await createPendingPublication(seller.id));
});

test.afterAll(async () => {
  if (!skip) await teardown();
});

async function assertNoSeriousViolations(page: Page, label: string): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const serious = results.violations.filter(
    (v) => v.impact === 'critical' || v.impact === 'serious',
  );
  if (serious.length) {
    console.error(
      `[axe:${label}]`,
      JSON.stringify(
        serious.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length })),
        null,
        2,
      ),
    );
  }
  expect(serious, `axe serious/critical violations on ${label}`).toEqual([]);
}

test('axe: dashboard / overview', async ({ page }) => {
  await adminSignIn(page, adminUser);
  await assertNoSeriousViolations(page, 'overview');
});

test('axe: customer profile', async ({ page }) => {
  await adminSignIn(page, adminUser);
  await page.goto(`/en/customers/${customer.id}`);
  await assertNoSeriousViolations(page, 'customer-profile');
});

test('axe: publication review', async ({ page }) => {
  await adminSignIn(page, adminUser);
  await page.goto(`/en/publication/${publicationRequestId}`);
  await assertNoSeriousViolations(page, 'publication-review');
});

test('axe: transactions list', async ({ page }) => {
  await adminSignIn(page, adminUser);
  await page.goto('/en/transactions');
  await assertNoSeriousViolations(page, 'transactions');
});

test('axe: audit log', async ({ page }) => {
  await adminSignIn(page, adminUser);
  await page.goto('/en/audit');
  await assertNoSeriousViolations(page, 'audit');
});
