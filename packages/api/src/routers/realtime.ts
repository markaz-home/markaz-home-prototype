import { sql } from 'drizzle-orm';
import { router, protectedProcedure } from '../trpc';

/** Realtime proof (Step 15): a permitted server mutation broadcast to subscribers. */
export const realtimeRouter = router({
  getCounter: protectedProcedure.query(async ({ ctx }) => {
    const r = await ctx.tx.execute(
      sql`select value from public.realtime_counters where id = 'demo'`,
    );
    const row = (r as unknown as Array<{ value: number }>)[0];
    return { value: Number(row?.value ?? 0) };
  }),

  increment: protectedProcedure.mutation(async ({ ctx }) => {
    const r = await ctx.tx.execute(
      sql`update public.realtime_counters set value = value + 1, updated_at = now() where id = 'demo' returning value`,
    );
    const row = (r as unknown as Array<{ value: number }>)[0];
    return { value: Number(row?.value ?? 0) };
  }),
});
