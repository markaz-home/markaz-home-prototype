import { defineConfig, devices } from '@playwright/test';

/**
 * Week-6 admin portal E2E. Requires the local Supabase stack + the admin app running:
 *   pnpm supabase:start && pnpm supabase:reset
 *   pnpm --filter @markaz/admin dev   (admin on :3001)
 * Provisioning uses the Supabase Admin API + SQL (loopback-only guard); never a real inbox.
 */
const ADMIN = process.env.NEXT_PUBLIC_ADMIN_URL ?? 'http://localhost:3001';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // admin flows mutate shared account/listing state
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: ADMIN,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.PLAYWRIGHT_NO_SERVER
    ? undefined
    : {
        command: 'pnpm --filter @markaz/admin dev',
        url: ADMIN,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
