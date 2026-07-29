import { router } from './trpc';
import { healthRouter } from './routers/health';
import { profileRouter } from './routers/profile';
import { authContextRouter } from './routers/auth-context';
import { realtimeRouter } from './routers/realtime';
import { listingRouter } from './routers/listing';
import { marketplaceRouter } from './routers/marketplace';
import { offersRouter } from './routers/offers';
import { transactionsRouter } from './routers/transactions';
import { adminRouter } from './routers/admin';
import { externalPropertiesRouter } from './routers/external-properties';
import { permitRouter } from './routers/permit';

/** Customer/public deployment surface. Admin procedures must never be mounted here. */
export const webRouter = router({
  health: healthRouter,
  profile: profileRouter,
  authContext: authContextRouter,
  realtime: realtimeRouter,
  listing: listingRouter,
  marketplace: marketplaceRouter,
  offers: offersRouter,
  transactions: transactionsRouter,
  externalProperties: externalPropertiesRouter,
  permit: permitRouter,
});

/** Separate Operations deployment surface. No customer marketplace mutations. */
export const adminAppRouter = router({
  health: healthRouter,
  admin: adminRouter,
});

/** Backwards-compatible name for customer-side callers and integration tests. */
export const appRouter = webRouter;

export type AppRouter = typeof webRouter;
export type AdminAppRouter = typeof adminAppRouter;
