import { sql } from 'drizzle-orm';
import { execRow } from '@markaz/db';
import { router, protectedProcedure, publicProcedure } from '../trpc';

export const authContextRouter = router({
  /**
   * Proves the RLS identity strategy (§6A.3): reports the DB-resolved auth.uid()
   * and current role for the running transaction. The DB uid MUST equal the
   * authenticated user id and the role MUST be `authenticated`, not a privileged
   * role — demonstrating the service-role key is not used for customer requests.
   */
  whoami: protectedProcedure.query(async ({ ctx }) => {
    const row = await execRow<{ db_uid: string | null; db_role: string | null }>(
      ctx.tx,
      sql`select auth.uid()::text as db_uid, current_setting('role', true) as db_role`,
    );
    return {
      sessionUserId: ctx.user.id,
      accountType: ctx.user.accountType,
      dbUid: row?.db_uid ?? null,
      dbRole: row?.db_role ?? null,
      contextMatches: row?.db_uid === ctx.user.id,
    };
  }),

  /** Anonymous identity probe (no user). */
  publicWhoami: publicProcedure.query(({ ctx }) => ({
    authenticated: ctx.user !== null,
  })),
});
