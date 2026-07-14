import { expect, type Page } from '@playwright/test';
import type { Principal } from './provision';

/** Sign into the operations portal and land on /overview. */
export async function adminSignIn(page: Page, principal: Principal, locale = 'en'): Promise<void> {
  await page.goto(`/${locale}/login`);
  await page.locator('#email').fill(principal.email);
  await page.locator('#password').fill(principal.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(new RegExp(`/${locale}/overview`), { timeout: 20_000 });
}

/** Open an entity detail page directly by id. */
export async function gotoDetail(
  page: Page,
  area: string,
  id: string,
  locale = 'en',
): Promise<void> {
  await page.goto(`/${locale}/${area}/${id}`);
}

/** Run a reason-coded confirmation action: click the trigger, pick a reason, submit. */
export async function runReasonAction(
  page: Page,
  triggerName: RegExp,
  reasonSelectLabel: RegExp,
  reasonValue: string,
  submitName: RegExp,
): Promise<void> {
  await page.getByRole('button', { name: triggerName }).first().click();
  // Scope to the open dialog — the trigger and submit buttons often share a label.
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel(reasonSelectLabel).selectOption(reasonValue);
  await dialog.getByRole('button', { name: submitName }).click();
  await expect(dialog).toBeHidden({ timeout: 15_000 });
}
