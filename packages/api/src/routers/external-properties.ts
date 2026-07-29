import { z } from 'zod';
import { marketplaceQuerySchema } from '@markaz/domain';
import { searchExternalListings } from '../integrations/external-listings';
import { searchBayutLocations } from '../integrations/bayut-locations';
import type {
  ExternalProviderResult,
  ExternalSearch,
} from '../integrations/external-listing-provider';
import { customerProcedure, publicProcedure, router } from '../trpc';

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

  /**
   * Place type-ahead for the listing wizard's location fields (Dubai only).
   * Customer-scoped: it proxies a keyed third-party quota, so it is not exposed
   * anonymously. Failures degrade to no suggestions — the field takes free text.
   */
  locations: customerProcedure
    .input(
      z.object({
        query: z.string().trim().max(80),
        locale: localeSchema,
        kind: z.enum(['AREA', 'BUILDING']).default('AREA'),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        return await searchBayutLocations(input);
      } catch (error) {
        ctx.log.warn(
          { errorCode: error instanceof Error ? error.message : 'UNKNOWN' },
          'external-properties.locations-unavailable',
        );
        return [];
      }
    }),

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
