import { sql } from 'drizzle-orm';
import { execRow } from '@markaz/db';
import { router, protectedProcedure } from '../trpc';

/** Realtime proof (Step 15): a permitted server mutation broadcast to subscribers. */
export const realtimeRouter = router({
  getCounter: protectedProcedure.query(async ({ ctx }) => {
    const row = await execRow<{ value: number }>(
      ctx.tx,
      sql`select value from public.realtime_counters where id = 'demo'`,
    );
    return { value: Number(row?.value ?? 0) };
  }),

  increment: protectedProcedure.mutation(async ({ ctx }) => {
    const row = await execRow<{ value: number }>(
      ctx.tx,
      sql`update public.realtime_counters set value = value + 1, updated_at = now() where id = 'demo' returning value`,
    );
    return { value: Number(row?.value ?? 0) };
  }),
});
