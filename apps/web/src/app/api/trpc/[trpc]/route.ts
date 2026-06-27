import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter, createTRPCContext } from '@markaz/api';
import { getAuthUser } from '@markaz/auth/server';

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: async () => {
      const user = await getAuthUser();
      return createTRPCContext({
        user: user ? { id: user.id, email: user.email ?? undefined } : null,
      });
    },
  });

export { handler as GET, handler as POST };
