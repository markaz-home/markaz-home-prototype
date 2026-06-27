import { router } from './trpc';
import { healthRouter } from './routers/health';
import { profileRouter } from './routers/profile';
import { authContextRouter } from './routers/auth-context';
import { adminOverviewRouter } from './routers/admin-overview';
import { realtimeRouter } from './routers/realtime';
import { auditRouter } from './routers/audit';

export const appRouter = router({
  health: healthRouter,
  profile: profileRouter,
  authContext: authContextRouter,
  adminOverview: adminOverviewRouter,
  realtime: realtimeRouter,
  audit: auditRouter,
});

export type AppRouter = typeof appRouter;
