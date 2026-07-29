import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { ZodError } from 'zod';
import { withUserContext, withAnonContext, type Tx } from '@markaz/db';
import { hasCapability, PROTOTYPE_ADMIN_CAPABILITIES, type AdminCapability } from '@markaz/domain';
import type { Context, AuthenticatedUser } from './context';

export function clientErrorMessage(
  code: string,
  message: string,
  production = process.env.NODE_ENV === 'production',
): string {
  return production && code === 'INTERNAL_SERVER_ERROR' ? 'Internal server error' : message;
}

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      message: clientErrorMessage(error.code, shape.message),
      data: {
        ...shape.data,
        stack: process.env.NODE_ENV === 'production' ? undefined : shape.data.stack,
        zod: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const router = t.router;
export const mergeRouters = t.mergeRouters;
export const createCallerFactory = t.createCallerFactory;
export const middleware = t.middleware;

/**
 * Slow-request threshold (ms). A request at or above this logs at WARN with
 * `slow: true` so it surfaces in ops dashboards without trawling the info stream.
 * Tune per environment via `SLOW_REQUEST_MS` (default 500). See
 * `docs/runbooks/measurement.md`.
 */
const SLOW_REQUEST_MS = Number(process.env.SLOW_REQUEST_MS ?? 500);

/** Structured request logging + timing on every procedure. */
const logging = middleware(async ({ ctx, path, type, next }) => {
  const start = Date.now();
  const result = await next();
  const ms = Date.now() - start;
  const fields = { path, type, ok: result.ok, ms, userId: ctx.user?.id };
  if (!result.ok) {
    ctx.log.error({ ...fields, errorCode: result.error.code }, 'trpc.request.failed');
  } else if (ms >= SLOW_REQUEST_MS) {
    ctx.log.warn({ ...fields, slow: true }, 'trpc.request.slow');
  } else ctx.log.info(fields, 'trpc.request');
  return result;
});

/** Public procedure — no authentication required. */
export const publicProcedure = t.procedure.use(logging);

/**
 * Rethrow a failed middleware result inside the transaction callback so the
 * transaction rejects with the resolver's (possibly mapped) error. tRPC's
 * `next()` never rejects — it returns `{ ok: false, error }` — so without this
 * the callback would resolve, postgres.js would commit any prior writes, and
 * a query that errored inside the transaction would surface as the RAW
 * database error (postgres.js `begin` rethrows the first query error when the
 * callback resolves), discarding resolver-level mappings such as
 * PRECONDITION_FAILED. Rejecting here both rolls back and preserves the
 * mapped error.
 */
async function unwrapTxResult<T extends { ok: boolean }>(resultPromise: Promise<T>): Promise<T> {
  const result = await resultPromise;
  if (!result.ok) throw (result as { error?: unknown }).error;
  return result;
}

/** Requires an authenticated user; runs the resolver inside an RLS-scoped tx. */
const enforceUserWithRls = middleware(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authentication required' });
  }
  const user: AuthenticatedUser = ctx.user;
  return withUserContext(
    ctx.db,
    { userId: user.id, email: user.email, accountType: user.accountType },
    (tx) => unwrapTxResult(next({ ctx: { ...ctx, user, tx } })),
  );
});

/** Authenticated procedure: resolver gets ctx.tx (RLS context) + non-null ctx.user. */
export const protectedProcedure = publicProcedure.use(enforceUserWithRls);

/** CUSTOMER-only procedure. */
export const customerProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.user.accountType !== 'CUSTOMER') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Requires a customer account' });
  }
  return next();
});

/** ADMIN-only procedure. */
export const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.user.accountType !== 'ADMIN') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Requires an admin account' });
  }
  return next();
});

/**
 * Capability-gated ADMIN procedure (admin-portal-design-spec §5). The single prototype
 * ADMIN holds every capability, but each consequential route/action still checks server-side
 * so the model can evolve without redesign. This is the boundary; UI hiding is UX only.
 * DB-level SECURITY DEFINER functions re-check `is_admin()` as defence-in-depth.
 */
export function adminCapabilityProcedure(cap: AdminCapability) {
  return adminProcedure.use(async ({ next }) => {
    if (!hasCapability(PROTOTYPE_ADMIN_CAPABILITIES, cap)) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'CAPABILITY_REQUIRED' });
    }
    return next();
  });
}

/**
 * Public marketplace procedure: runs the resolver inside an RLS-scoped tx as the
 * authenticated user when present, or as `anon` otherwise. Either way RLS only
 * exposes LIVE public data — anonymous browsing never needs the service-role key
 * (§37.3, ADR-0013). Resolvers must still filter `state = 'LIVE'` explicitly.
 */
const publicWithRls = middleware(async ({ ctx, next }) => {
  if (ctx.user) {
    const user: AuthenticatedUser = ctx.user;
    return withUserContext(
      ctx.db,
      { userId: user.id, email: user.email, accountType: user.accountType },
      (tx) => unwrapTxResult(next({ ctx: { ...ctx, tx } })),
    );
  }
  return withAnonContext(ctx.db, (tx) => unwrapTxResult(next({ ctx: { ...ctx, tx } })));
});

/** Anonymous-or-authenticated procedure with an RLS tx (`ctx.tx`). */
export const publicTxProcedure = publicProcedure.use(publicWithRls);

export type { Tx };
