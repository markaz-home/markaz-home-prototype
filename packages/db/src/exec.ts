import type { SQL } from 'drizzle-orm';

/**
 * Minimal executor shape — anything that can run a raw Drizzle SQL statement
 * (an RLS `Tx` or a `Database`). Kept structural so callers pass `ctx.tx` or
 * `ctx.db` without importing concrete types.
 */
interface Executor {
  execute(query: SQL): Promise<unknown>;
}

/**
 * Run a raw SQL statement and return the rows typed as `T[]`.
 *
 * Drizzle's `.execute()` is intentionally loosely typed (it can't know the shape
 * of an arbitrary `SELECT` or a `SECURITY DEFINER` function result), so a cast is
 * unavoidable. This centralizes that single cast in ONE audited place instead of
 * scattering `as unknown as Array<…>` across every call site. The caller owns the
 * correctness of `T` against the selected columns — same contract as before, just
 * expressed once and with a typed call site.
 */
export async function execRows<T>(ex: Executor, query: SQL): Promise<T[]> {
  return (await ex.execute(query)) as T[];
}

/** First row of a raw SQL result, or `null` when the result is empty. */
export async function execRow<T>(ex: Executor, query: SQL): Promise<T | null> {
  const rows = await execRows<T>(ex, query);
  return rows[0] ?? null;
}
