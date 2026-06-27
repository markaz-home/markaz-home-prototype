import { test, expect, type Page } from '@playwright/test';

/**
 * Real Supabase email OTP via the local Inbucket inbox (never a real inbox).
 * Requires the local stack: pnpm supabase:start && pnpm supabase:reset.
 * Skipped automatically if Inbucket is not reachable.
 */
const INBUCKET = 'http://127.0.0.1:54324';

async function inbucketReachable(): Promise<boolean> {
  try {
    const res = await fetch(`${INBUCKET}/api/v1/mailbox/healthcheck`);
    return res.ok || res.status === 404; // 404 = empty mailbox, server is up
  } catch {
    return false;
  }
}

async function latestOtp(mailbox: string): Promise<string> {
  // Poll the mailbox for the newest message and extract the 6-digit code.
  for (let i = 0; i < 20; i++) {
    const list = await fetch(`${INBUCKET}/api/v1/mailbox/${mailbox}`).then((r) => r.json());
    if (Array.isArray(list) && list.length > 0) {
      const id = list[list.length - 1].id;
      const msg = await fetch(`${INBUCKET}/api/v1/mailbox/${mailbox}/${id}`).then((r) => r.json());
      const body = `${msg.body?.text ?? ''} ${msg.body?.html ?? ''}`;
      const code = body.match(/\b(\d{6})\b/)?.[1];
      if (code) return code;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No OTP found in Inbucket mailbox "${mailbox}"`);
}

async function signInWithOtp(page: Page, email: string) {
  await page.goto('/en/sign-in');
  await page.getByLabel(/Email address/i).fill(email);
  await page.getByRole('button', { name: /Send code/i }).click();
  await expect(page.getByText('Enter your code')).toBeVisible();
  const code = await latestOtp(email.split('@')[0] ?? email);
  await page.getByLabel(/6-digit code/i).fill(code);
  await page.getByRole('button', { name: /^Verify$/i }).click();
}

test.describe('email OTP authentication', () => {
  test.beforeEach(async () => {
    test.skip(!(await inbucketReachable()), 'Local Supabase/Inbucket not running');
  });

  test('a brand-new customer is routed through profile setup', async ({ page }) => {
    const email = `new-${Date.now()}@markaz.demo`;
    await signInWithOtp(page, email);
    await expect(page).toHaveURL(/\/en\/onboarding\/profile/);
    await expect(page.getByText('Set up your profile')).toBeVisible();
  });

  test('a returning verified customer skips onboarding to the dashboard', async ({ page }) => {
    // Customer A is seeded as VERIFIED_DEMO with a complete profile.
    await signInWithOtp(page, 'customer-a@markaz.demo');
    await expect(page).toHaveURL(/\/en\/dashboard/);
    await expect(page.getByText(/Browse Properties/i).first()).toBeVisible();
  });

  test('a customer cannot reach the admin application', async ({ page }) => {
    await signInWithOtp(page, 'customer-a@markaz.demo');
    const adminUrl = process.env.NEXT_PUBLIC_ADMIN_URL ?? 'http://localhost:3001';
    await page.goto(`${adminUrl}/en/overview`);
    // Non-admin is denied (redirected to access-denied or login), never the overview.
    await expect(page).not.toHaveURL(/\/overview$/);
  });
});
