/* eslint-disable no-console */
// Guarded E2E runner. Runs the Playwright offer specs only when the full local
// stack is available (signalled by SUPABASE_SERVICE_ROLE_KEY); otherwise skips
// cleanly with a clear message so `pnpm test:e2e` stays green in environments
// without Docker/Supabase. This is intentionally honest: it does NOT claim to
// have run when it has not.
import { spawnSync } from 'node:child_process';

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log(
    '[e2e] skipped — full stack required.\n' +
      '      Run: pnpm supabase:start && pnpm supabase:reset && pnpm dev\n' +
      '      then: SUPABASE_SERVICE_ROLE_KEY=<local secret> pnpm --filter @markaz/web test:e2e',
  );
  process.exit(0);
}

const res = spawnSync('playwright', ['test'], { stdio: 'inherit', shell: true });
process.exit(res.status ?? 1);
