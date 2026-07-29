import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { router, publicTxProcedure } from '../trpc';

interface VerificationRow {
  permit_number: string;
  status: string;
  approved_at: string | null;
  property_type: string | null;
  community: string | null;
  building_or_project: string | null;
  emirate: string | null;
  listing_public_id: string | null;
  listing_slug: string | null;
  listing_is_live: boolean;
}

/**
 * Public verification of an advertising permit — the destination of the Madmoun
 * QR shown on the listing. Anonymous-or-authenticated; the SECURITY DEFINER
 * function `public.permit_verification` owns the public-safe projection, so no
 * private column (notably the unit identifier) can leak through this route.
 */
export const permitRouter = router({
  verify: publicTxProcedure
    .input(z.object({ permitNumber: z.string().trim().min(3).max(64) }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.tx.execute(
        sql`select * from public.permit_verification(${input.permitNumber})`,
      );
      const rows = (Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows) ?? [];
      const row = rows[0] as VerificationRow | undefined;
      if (!row) return null;
      return {
        permitNumber: row.permit_number,
        approvedAt: row.approved_at,
        propertyType: row.property_type,
        community: row.community,
        buildingOrProject: row.building_or_project,
        emirate: row.emirate,
        publicId: row.listing_is_live ? row.listing_public_id : null,
        slug: row.listing_is_live ? row.listing_slug : null,
        isLive: row.listing_is_live,
      };
    }),
});
