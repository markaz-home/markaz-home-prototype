/**
 * UI flow helpers for the offer E2E specs. Selectors use stable ids and verified
 * i18n copy (packages/i18n/messages/en.json). If the design copy changes, update
 * the strings here in one place.
 */
import { expect, type Page } from '@playwright/test';
import type { Customer } from './provision';

/** Sign in through the UI and land in the authenticated app. */
export async function signIn(page: Page, customer: Customer, locale = 'en'): Promise<void> {
  await page.goto(`/${locale}/sign-in`);
  await page.locator('#email').fill(customer.email);
  await page.locator('#password').fill(customer.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  // A fully-onboarded customer lands on the dashboard.
  await page.waitForURL(new RegExp(`/${locale}/dashboard`), { timeout: 20_000 });
}

/** Buyer submits an initial offer; the app then shows the thread ("Waiting for seller"). */
export async function makeOffer(
  page: Page,
  listing: { publicId: string; slug: string },
  amount: number,
  locale = 'en',
): Promise<void> {
  await page.goto(`/${locale}/properties/${listing.publicId}/${listing.slug}/offer`);
  await page.getByLabel(/Your offer/i).fill(String(amount));
  await page.getByRole('button', { name: 'Review offer' }).click();
  await page.getByRole('button', { name: 'Submit offer' }).click();
  await expect(page.getByText(/Your offer has been sent|Waiting for seller/i).first()).toBeVisible({ timeout: 15_000 });
}

/** Open the single active thread for the signed-in user via the Offers hub. */
export async function openFirstThread(page: Page, view: 'made' | 'received', locale = 'en'): Promise<void> {
  await page.goto(`/${locale}/offers?view=${view}`);
  await page.getByRole('link', { name: /Review offer|View offer/i }).first().click();
  await page.waitForURL(/\/offers\/[0-9a-f-]{36}/, { timeout: 15_000 });
}

/** Counter the current proposal (single-step dialog). */
export async function counter(page: Page, amount: number): Promise<void> {
  await page.getByRole('button', { name: 'Make counteroffer' }).click();
  await page.locator('#counter-amount').fill(String(amount));
  await page.getByRole('button', { name: 'Submit counteroffer' }).click();
  // Dialog closes on success.
  await expect(page.locator('#counter-amount')).toHaveCount(0, { timeout: 10_000 });
}

/** Accept the current proposal (trigger button + confirmation dialog). */
export async function acceptOffer(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Accept offer' }).click();
  await page.getByRole('button', { name: /^Accept offer$|^Accept counteroffer$/ }).last().click();
  await expect(page.getByText('Offer accepted').first()).toBeVisible({ timeout: 15_000 });
}
