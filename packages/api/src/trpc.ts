import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { ZodError } from 'zod';
import { withUserContext, withAnonContext, type Tx } from '@markaz/db';
import { hasCapability, PROTOTYPE_ADMIN_CAPABILITIES, type AdminCapability } from '@markaz/domain';
import type { Context, AuthenticatedUser } from './context';

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zod: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const router = t.router;
export const createCallerFactory = t.createCallerFactory;
export const middleware = t.middleware;

/** Structured request logging on every procedure. */
const logging = middleware(async ({ ctx, path, type, next }) => {
  const start = Date.now();
  const result = await next();
  ctx.log.info(
    { path, type, ok: result.ok, ms: Date.now() - start, userId: ctx.user?.id },
    'trpc.request',
  );
  return result;
});

/** Public procedure — no authentication required. */
export const publicProcedure = t.procedure.use(logging);

/** Requires an authenticated user; runs the resolver inside an RLS-scoped tx. */
const enforceUserWithRls = middleware(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authentication required' });
  }
  const user: AuthenticatedUser = ctx.user;
  return withUserContext(
    ctx.db,
    { userId: user.id, email: user.email, accountType: user.accountType },
    (tx) => next({ ctx: { ...ctx, user, tx } }),
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
      (tx) => next({ ctx: { ...ctx, tx } }),
    );
  }
  return withAnonContext(ctx.db, (tx) => next({ ctx: { ...ctx, tx } }));
});

/** Anonymous-or-authenticated procedure with an RLS tx (`ctx.tx`). */
export const publicTxProcedure = publicProcedure.use(publicWithRls);

export type { Tx };
