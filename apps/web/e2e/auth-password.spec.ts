import { test, expect, type Page } from '@playwright/test';

/**
 * Email/password auth (Week 1.5, design-spec fidelity) end-to-end via local Mailpit.
 * Requires: pnpm supabase:start && pnpm supabase:reset && pnpm db:setup, both apps
 * running. Skipped automatically if Mailpit is not reachable. Never a public inbox.
 */
const MAILPIT = 'http://127.0.0.1:54324';
const STRONG_PASSWORD = 'Markaz!Demo1';

async function mailpitReachable(): Promise<boolean> {
  try {
    return (await fetch(`${MAILPIT}/api/v1/messages?limit=1`)).ok;
  } catch {
    return false;
  }
}

async function latestMessageBody(email: string): Promise<string> {
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
        return `${msg.Text ?? ''} ${msg.HTML ?? ''}`;
      }
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No email found in Mailpit for ${email}`);
}

const codeFrom = (body: string) => body.match(/\b(\d{6})\b/)?.[1];
const linkFrom = (body: string) =>
  body.match(/https?:\/\/[^"'\s>]*token_hash=[^"'\s>]+/)?.[0]?.replace(/&amp;/g, '&');

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

  test('new customer: sign up → check email → verify → demo identity → dashboard', async ({ page }) => {
    const email = `new-${Date.now()}@markaz.demo`;
    await page.goto('/en/sign-up');
    await page.getByLabel(/Full name/i).fill('Test Customer');
    await page.getByLabel(/Email address/i).fill(email);
    await page.getByLabel(/^Password/).fill(STRONG_PASSWORD);
    await page.getByLabel(/^Confirm password/).fill(STRONG_PASSWORD);
    await page.getByText('I agree to the Terms of Use.').click();
    await page.getByText('I agree to the Privacy Policy.').click();
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page).toHaveURL(/\/en\/sign-up\/check-email/);
    await page.getByRole('link', { name: /Enter verification code/i }).click();
    await expect(page).toHaveURL(/\/en\/verify-email/);

    const code = codeFrom(await latestMessageBody(email));
    await page.getByLabel('Verification code').fill(code!);
    await page.getByRole('button', { name: 'Verify email' }).click();

    await expect(page).toHaveURL(/\/en\/verify-email\/success/);
    await page.getByRole('link', { name: /Continue to demo identity/i }).click();
    await expect(page).toHaveURL(/\/en\/onboarding\/uae-pass/);
    await page.getByRole('button', { name: 'Start demo verification' }).click();
    await page.getByRole('button', { name: 'Approve demo verification' }).click();
    // The success screen does not auto-redirect (design spec §16.6); the customer
    // confirms with "Go to dashboard".
    await page.getByRole('button', { name: 'Go to dashboard' }).click();
    await expect(page).toHaveURL(/\/en\/dashboard/);
  });

  test('returning customer signs in and reaches the dashboard', async ({ page }) => {
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
    await page.getByText('I agree to the Terms of Use.').click();
    await page.getByText('I agree to the Privacy Policy.').click();
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByText(/We could not create a new account/)).toBeVisible();
  });

  test('password recovery via link → reset → sign in with new password', async ({ page }) => {
    const email = 'customer-b@markaz.demo';
    await page.goto('/en/forgot-password');
    await page.getByLabel(/Email address/i).fill(email);
    await page.getByRole('button', { name: /Send recovery email/i }).click();
    await expect(page).toHaveURL(/\/en\/forgot-password\/check-email/);

    const link = linkFrom(await latestMessageBody(email));
    expect(link, 'recovery link present in email').toBeTruthy();
    await page.goto(link!); // /auth/confirm → verifies → /reset-password
    await expect(page).toHaveURL(/\/reset-password/);

    // Unique per run so a re-run never sets the same password twice (GoTrue
    // rejects "new password == current"), keeping the recovery test idempotent.
    const newPassword = `NewMarkaz!${Date.now() % 1000000}`;
    await page.getByLabel(/^New password/).fill(newPassword);
    await page.getByLabel(/^Confirm new password/).fill(newPassword);
    await page.getByRole('button', { name: /Update password/i }).click();

    await expect(page).toHaveURL(/\/reset-password\/success/);
    await page.getByRole('link', { name: 'Sign in' }).click();

    // The old password (the demo default in a clean run) no longer works.
    await signIn(page, email, STRONG_PASSWORD);
    await expect(page.getByText('The email or password is incorrect.')).toBeVisible();
    await expect(page).not.toHaveURL(/\/en\/dashboard/);

    // The new password works.
    await signIn(page, email, newPassword);
    await expect(page).toHaveURL(/\/en\/dashboard/);
  });

  test('a customer cannot reach the admin application', async ({ page }) => {
    await signIn(page, 'customer-a@markaz.demo', STRONG_PASSWORD);
    await expect(page).toHaveURL(/\/en\/dashboard/);
    const adminUrl = process.env.NEXT_PUBLIC_ADMIN_URL ?? 'http://localhost:3001';
    await page.goto(`${adminUrl}/en/overview`);
    await expect(page).not.toHaveURL(/\/overview$/);
  });
});
