import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { webRouter, createTRPCContext } from '@markaz/api';
import { getHttpRequestOrigin, isTrustedHttpRequestOrigin } from '@markaz/api/http-security';
import { getAuthProviderIds, getAuthUser } from '@markaz/auth/server';

const handler = (req: Request) => {
  if (
    !isTrustedHttpRequestOrigin({
      method: req.method,
      origin: req.headers.get('origin'),
      requestOrigin: getHttpRequestOrigin(req),
      allowedOrigin: process.env.NEXT_PUBLIC_WEB_URL,
    })
  ) {
    return Response.json({ error: 'Request origin is not allowed.' }, { status: 403 });
  }
  return fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: webRouter,
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
};

export { handler as GET, handler as POST };
