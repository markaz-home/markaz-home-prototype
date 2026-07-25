import { z } from 'zod';
import { marketplaceQuerySchema } from '@markaz/domain';
import { searchExternalListings } from '../integrations/external-listings';
import type {
  ExternalProviderResult,
  ExternalSearch,
} from '../integrations/external-listing-provider';
import { publicProcedure, router } from '../trpc';

const localeSchema = z.enum(['en', 'ar']).default('en');
const limitSchema = z.number().int().min(1).max(12).default(6);

type ExternalLog = {
  warn(bindings: Record<string, unknown>, message: string): void;
};

async function resolveExternalProperties(log: ExternalLog, params: ExternalSearch) {
  const result = await searchExternalListings(params);
  for (const provider of result.providers) {
    if (provider.enabled && !provider.available) {
      log.warn(
        { provider: provider.id, errorCode: provider.errorCode ?? 'UNKNOWN' },
        'external-properties.unavailable',
      );
    }
  }

  const publicProviderStatus = (provider: ExternalProviderResult) => ({
    id: provider.id,
    enabled: provider.enabled,
    available: provider.available,
  });
  return {
    enabled: result.providers.some((provider) => provider.enabled),
    available: result.providers.some((provider) => provider.available),
    providers: result.providers.map(publicProviderStatus),
    items: result.items,
  };
}

export const externalPropertiesRouter = router({
  featured: publicProcedure
    .input(
      z.object({
        locale: localeSchema,
        limit: limitSchema,
      }),
    )
    .query(({ ctx, input }) => resolveExternalProperties(ctx.log, input)),

  /** Provider-neutral external inventory search. Unsupported filters fail closed. */
  search: publicProcedure
    .input(
      z.object({
        locale: localeSchema,
        limit: limitSchema,
        query: marketplaceQuerySchema.optional(),
      }),
    )
    .query(({ ctx, input }) => resolveExternalProperties(ctx.log, input)),
});
