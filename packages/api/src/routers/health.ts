import { sql } from 'drizzle-orm';
import { getDirectDb } from '@markaz/db';
import { router, publicProcedure } from '../trpc';

export const healthRouter = router({
  /** Liveness + DB connectivity check (no auth). */
  check: publicProcedure.query(async () => {
    let database = false;
    try {
      await getDirectDb().execute(sql`select 1`);
      database = true;
    } catch {
      database = false;
    }
    return { status: 'ok' as const, database, service: 'markaz-api' };
  }),
});
