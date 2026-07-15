import { z } from 'zod';
import { BayutApiError, getBayutApiMode, loadBayutFeaturedProperties } from '../integrations/bayut';
import { publicProcedure, router } from '../trpc';

export const externalPropertiesRouter = router({
  featured: publicProcedure
    .input(
      z.object({
        locale: z.enum(['en', 'ar']).default('en'),
        limit: z.number().int().min(1).max(12).default(6),
      }),
    )
    .query(async ({ ctx, input }) => {
      const enabled = getBayutApiMode() === 'rapidapi';
      if (!enabled) {
        return { provider: 'BAYUT_API' as const, enabled: false, available: false, items: [] };
      }
      try {
        const items = await loadBayutFeaturedProperties(input);
        return { provider: 'BAYUT_API' as const, enabled: true, available: true, items };
      } catch (error) {
        ctx.log.warn(
          {
            provider: 'BAYUT_API',
            errorCode: error instanceof BayutApiError ? error.code : 'UNKNOWN',
          },
          'external-properties.unavailable',
        );
        return { provider: 'BAYUT_API' as const, enabled: true, available: false, items: [] };
      }
    }),
});
