import { defineConfig, devices } from '@playwright/test';

/**
 * Foundational E2E. Requires the local Supabase stack + both apps running:
 *   pnpm supabase:start && pnpm supabase:reset
 *   pnpm dev   (web on :3000, admin on :3001)
 * CI uses the local Supabase OTP flow via Inbucket — never a real inbox.
 */
const WEB = process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: WEB,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.PLAYWRIGHT_NO_SERVER
    ? undefined
    : {
        command: 'pnpm --filter @markaz/web dev',
        url: WEB,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
