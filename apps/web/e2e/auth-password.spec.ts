import { test, expect, type Page } from '@playwright/test';

/**
 * Email/password auth (Week 1.5) end-to-end via the local Mailpit inbox.
 * Requires: pnpm supabase:start && pnpm supabase:reset && pnpm db:setup, both
 * apps running. Skipped automatically if Mailpit is not reachable. Never uses a
 * public inbox.
 */
const MAILPIT = 'http://127.0.0.1:54324';
const STRONG_PASSWORD = 'Markaz!Demo1';

async function mailpitReachable(): Promise<boolean> {
  try {
    const r = await fetch(`${MAILPIT}/api/v1/messages?limit=1`);
    return r.ok;
  } catch {
    return false;
  }
}

async function latestCodeFor(email: string): Promise<string> {
  for (let i = 0; i < 24; i++) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
    if (res.ok) {
      const list = (await res.json()) as { messages?: Array<{ ID: string }> };
      const newest = list.messages?.[0];
      if (newest) {
        const msg = (await fetch(`${MAILPIT}/api/v1/message/${newest.ID}`).then((r) => r.json())) as {
          Text?: string;
          HTML?: string;
        };
        const code = `${msg.Text ?? ''} ${msg.HTML ?? ''}`.match(/\b(\d{6})\b/)?.[1];
        if (code) return code;
      }
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No verification code found in Mailpit for ${email}`);
}

async function signIn(page: Page, email: string, password: string) {
  await page.goto('/en/sign-in');
  await page.getByLabel(/Email address/i).fill(email);
  await page.getByLabel(/^Password/).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

test.describe('email/password authentication', () => {
  test.beforeEach(async () => {
    test.skip(!(await mailpitReachable()), 'Local Supabase/Mailpit not running');
  });

  test('new customer: sign up → verify email → simulated UAE PASS → dashboard', async ({ page }) => {
    const email = `new-${Date.now()}@markaz.demo`;
    await page.goto('/en/sign-up');
    await page.getByLabel(/Full name/i).fill('Test Customer');
    await page.getByLabel(/Email address/i).fill(email);
    await page.getByLabel(/^Password/).fill(STRONG_PASSWORD);
    await page.getByLabel(/^Confirm password/).fill(STRONG_PASSWORD);
    await page.getByText('I accept the Terms of Use.').click();
    await page.getByText('I accept the Privacy Policy.').click();
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page).toHaveURL(/\/en\/verify-email/);
    const code = await latestCodeFor(email);
    await page.getByLabel(/6-digit code/i).fill(code);
    await page.getByRole('button', { name: 'Verify email' }).click();

    // Profile is complete (from sign-up metadata) → straight to UAE PASS.
    await expect(page).toHaveURL(/\/en\/onboarding\/uae-pass/);
    await page.getByRole('button', { name: /Start demo verification/i }).click();
    await page.getByRole('button', { name: /Approve demo verification/i }).click();
    await expect(page).toHaveURL(/\/en\/dashboard/);
  });

  test('returning customer signs in with password and reaches the dashboard', async ({ page }) => {
    await signIn(page, 'customer-a@markaz.demo', STRONG_PASSWORD);
    await expect(page).toHaveURL(/\/en\/dashboard/);
  });

  test('incorrect password shows a generic error', async ({ page }) => {
    await signIn(page, 'customer-a@markaz.demo', 'Wrongpass1!');
    await expect(page.getByText('The email or password is incorrect.')).toBeVisible();
  });

  test('duplicate email sign-up is handled safely', async ({ page }) => {
    await page.goto('/en/sign-up');
    await page.getByLabel(/Full name/i).fill('Dupe');
    await page.getByLabel(/Email address/i).fill('customer-a@markaz.demo');
    await page.getByLabel(/^Password/).fill(STRONG_PASSWORD);
    await page.getByLabel(/^Confirm password/).fill(STRONG_PASSWORD);
    await page.getByText('I accept the Terms of Use.').click();
    await page.getByText('I accept the Privacy Policy.').click();
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByText('We could not create a new account')).toBeVisible();
    await expect(page).not.toHaveURL(/verify-email/);
  });

  test('password recovery: forgot → code → reset → sign in with new password', async ({ page }) => {
    const email = 'customer-b@markaz.demo';
    await page.goto('/en/forgot-password');
    await page.getByLabel(/Email address/i).fill(email);
    await page.getByRole('button', { name: /Send recovery code/i }).click();
    await page.getByRole('button', { name: /I have a recovery code/i }).click();

    await expect(page).toHaveURL(/\/en\/reset-password/);
    const code = await latestCodeFor(email);
    const newPassword = 'NewMarkaz!2';
    await page.getByLabel(/6-digit code/i).fill(code);
    await page.getByLabel(/^New password/).fill(newPassword);
    await page.getByLabel(/^Confirm new password/).fill(newPassword);
    await page.getByRole('button', { name: /Update password/i }).click();

    await expect(page).toHaveURL(/\/en\/sign-in/);
    await expect(page.getByText(/Password updated/i)).toBeVisible();
    await signIn(page, email, newPassword);
    await expect(page).toHaveURL(/\/en\/dashboard/);
    // restore the seeded password for re-runs
    await page.goto('/en/dashboard');
  });

  test('a customer cannot reach the admin application', async ({ page }) => {
    await signIn(page, 'customer-a@markaz.demo', STRONG_PASSWORD);
    await expect(page).toHaveURL(/\/en\/dashboard/);
    const adminUrl = process.env.NEXT_PUBLIC_ADMIN_URL ?? 'http://localhost:3001';
    await page.goto(`${adminUrl}/en/overview`);
    await expect(page).not.toHaveURL(/\/overview$/);
  });
});
