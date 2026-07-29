import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('foundation', () => {
  test('landing renders and routes to sign-in', async ({ page }) => {
    await page.goto('/en');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    // Landing routes every primary CTA to sign-in (design foundation); use the header link.
    await page.getByRole('link', { name: 'Sign in' }).first().click();
    await expect(page).toHaveURL(/\/en\/sign-in/);
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  });

  test('language switch toggles to Arabic and sets RTL direction', async ({ page }) => {
    await page.goto('/en');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await page.goto('/ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  });

  test('hero filters stay above the featured-property section', async ({ page }) => {
    await page.goto('/en');
    await page.getByRole('button', { name: 'Bedrooms Any' }).click();

    const listbox = page.getByRole('listbox', { name: 'Bedrooms' });
    await expect(listbox).toBeVisible();

    const isTopmost = await listbox.evaluate((element) => {
      const menu = element.getBoundingClientRect();
      const hero = element.closest('section');
      const followingContent = hero?.nextElementSibling;
      const followingTop = followingContent?.getBoundingClientRect().top ?? menu.top;
      const x = menu.left + menu.width / 2;
      const y = Math.min(menu.bottom - 2, Math.max(menu.top + 2, followingTop + 2));
      const topmost = document.elementFromPoint(x, y);
      return topmost === element || element.contains(topmost);
    });

    expect(isTopmost).toBe(true);
  });

  test('an unauthenticated visitor is redirected from a protected route to sign-in', async ({
    page,
  }) => {
    await page.goto('/en/dashboard');
    await expect(page).toHaveURL(/\/en\/sign-in/);
  });

  test('landing has no critical accessibility violations', async ({ page }) => {
    await page.goto('/en');
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const serious = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
  });
});
