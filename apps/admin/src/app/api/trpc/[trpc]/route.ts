import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { adminAppRouter, createTRPCContext } from '@markaz/api';
import { getAuthProviderIds, getAuthUser } from '@markaz/auth/server';

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: adminAppRouter,
    createContext: async () => {
      const user = await getAuthUser();
      return createTRPCContext({
        user: user
          ? {
              id: user.id,
              email: user.email ?? undefined,
              authProviders: getAuthProviderIds(user),
            }
          : null,
      });
    },
  });

export { handler as GET, handler as POST };
