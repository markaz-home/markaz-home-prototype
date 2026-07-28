import 'server-only';
import { adminAppRouter, createTRPCContext, createCallerFactory } from '@markaz/api';
import { getAuthProviderIds, getAuthUser } from '@markaz/auth/server';

const createCaller = createCallerFactory(adminAppRouter);

/** Server-side tRPC caller bound to the current request's authenticated user. */
export async function getServerApi() {
  const user = await getAuthUser();
  const ctx = await createTRPCContext({
    user: user
      ? {
          id: user.id,
          email: user.email ?? undefined,
          authProviders: getAuthProviderIds(user),
        }
      : null,
  });
  return createCaller(ctx);
}

export { type AdminAppRouter } from '@markaz/api';
