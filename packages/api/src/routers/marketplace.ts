import { and, asc, desc, eq, gte, ilike, lte, or, sql, type SQL } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
  listings,
  savedProperties,
  auditEvents,
  marketplaceListings as mv,
  type Tx,
} from '@markaz/db';
import { marketplaceQuerySchema, paginate, type MarketplaceQuery } from '@markaz/domain';
import { toPublicCard, toPublicDetail, type PublicListingRow } from '../public-projection';
import { router, publicTxProcedure, customerProcedure } from '../trpc';

/** Filter conditions over the public marketplace view (LIVE-only by construction). */
function buildConditions(input: MarketplaceQuery): SQL[] {
  const c: SQL[] = [];
  if (input.type) c.push(eq(mv.propertyType, input.type));
  if (input.emirate) c.push(eq(mv.emirate, input.emirate));
  if (input.area) c.push(ilike(mv.community, `%${input.area}%`));
  if (input.minPrice != null) c.push(gte(mv.askingPrice, String(input.minPrice)));
  if (input.maxPrice != null) c.push(lte(mv.askingPrice, String(input.maxPrice)));
  if (input.minSize != null) c.push(gte(mv.sizeSqft, String(input.minSize)));
  if (input.maxSize != null) c.push(lte(mv.sizeSqft, String(input.maxSize)));
  if (input.furnishing) c.push(eq(mv.furnishingStatus, input.furnishing));
  if (input.completion) c.push(eq(mv.completionStatus, input.completion));
  if (input.beds === 'studio') c.push(eq(mv.bedrooms, 0));
  else if (input.beds) c.push(gte(mv.bedrooms, Number(input.beds)));
  if (input.baths) c.push(gte(mv.bathrooms, Number(input.baths)));
  if (input.investmentCase) c.push(eq(mv.icVisible, true));
  if (input.q) {
    const like = `%${input.q}%`;
    const m = or(
      ilike(mv.community, like),
      ilike(mv.emirate, like),
      ilike(mv.buildingOrProject, like),
      ilike(mv.propertyType, like),
    );
    if (m) c.push(m);
  }
  return c;
}

function orderFor(sortKey: MarketplaceQuery['sort']) {
  switch (sortKey) {
    case 'PRICE_ASC':
      return [asc(mv.askingPrice), asc(mv.publicId)];
    case 'PRICE_DESC':
      return [desc(mv.askingPrice), asc(mv.publicId)];
    case 'SIZE_DESC':
      return [desc(mv.sizeSqft), asc(mv.publicId)];
    default:
      return [desc(mv.publishedAt), asc(mv.publicId)];
  }
}

type ViewRow = typeof mv.$inferSelect;
function toRow(r: ViewRow): PublicListingRow {
  return {
    publicId: r.publicId,
    publicSlug: r.publicSlug,
    state: r.state ?? 'LIVE',
    askingPrice: r.askingPrice,
    description: r.description,
    publishedAt: r.publishedAt,
    publicUpdatedAt: r.publicUpdatedAt,
    property: {
      propertyType: r.propertyType,
      emirate: r.emirate,
      community: r.community,
      buildingOrProject: r.buildingOrProject,
      bedrooms: r.bedrooms,
      bathrooms: r.bathrooms,
      sizeSqft: r.sizeSqft,
      furnishingStatus: r.furnishingStatus,
      completionStatus: r.completionStatus,
      parkingSpaces: r.parkingSpaces,
      features: r.features ?? [],
    },
    coverPublicPath: r.coverPublicPath,
    photoPublicPaths: r.photoPublicPaths ?? [],
    investmentCase: {
      visible: r.icVisible === true,
      estimatedRoiPct: r.icRoi,
      estimatedAnnualisedReturnPct: r.icAnnualised,
      pricePerSqft: r.icPricePerSqft,
    },
  };
}

async function loadLiveListing(
  tx: Tx,
  publicId: string,
): Promise<{ id: string; ownerId: string } | null> {
  const [row] = await tx
    .select({ id: listings.id, ownerId: listings.ownerId })
    .from(listings)
    .where(and(eq(listings.publicId, publicId), eq(listings.state, 'LIVE')))
    .limit(1);
  return row ?? null;
}

export const marketplaceRouter = router({
  /** Public, paginated marketplace search (anonymous-or-authenticated). */
  search: publicTxProcedure.input(marketplaceQuerySchema).query(async ({ ctx, input }) => {
    const conds = buildConditions(input);
    const where = conds.length ? and(...conds) : undefined;
    const totalRows = await ctx.tx
      .select({ total: sql<number>`count(*)::int` })
      .from(mv)
      .where(where);
    const pag = paginate(totalRows[0]?.total ?? 0, input.page);
    const rows = await ctx.tx
      .select()
      .from(mv)
      .where(where)
      .orderBy(...orderFor(input.sort))
      .limit(pag.pageSize)
      .offset((pag.page - 1) * pag.pageSize);
    return { items: rows.map((r) => toPublicCard(toRow(r))), pagination: pag };
  }),

  /** Public property detail by opaque public id (LIVE only). */
  getByPublicId: publicTxProcedure
    .input(z.object({ publicId: z.string().max(40) }))
    .query(async ({ ctx, input }) => {
      const [row] = await ctx.tx.select().from(mv).where(eq(mv.publicId, input.publicId)).limit(1);
      if (!row) return null; // unified unavailable state (anti-enumeration)
      let isOwner = false;
      let manageListingId: string | null = null;
      if (ctx.user) {
        const [owned] = await ctx.tx
          .select({ id: listings.id })
          .from(listings)
          .where(and(eq(listings.publicId, input.publicId), eq(listings.ownerId, ctx.user.id)))
          .limit(1);
        isOwner = !!owned;
        manageListingId = owned?.id ?? null; // owner-only: deep-link to manage their own listing
      }
      return { ...toPublicDetail(toRow(row)), isOwner, manageListingId };
    }),

  /** Distinct public facet values for filter menus (LIVE only). */
  getFilterOptions: publicTxProcedure.query(async ({ ctx }) => {
    const rows = await ctx.tx
      .select({ emirate: mv.emirate, community: mv.community, type: mv.propertyType })
      .from(mv);
    const uniq = (xs: (string | null)[]) => [...new Set(xs.filter((x): x is string => !!x))].sort();
    return {
      emirates: uniq(rows.map((r) => r.emirate)),
      communities: uniq(rows.map((r) => r.community)),
      propertyTypes: uniq(rows.map((r) => r.type)),
    };
  }),

  /** The viewer's OWN live listing public ids (so grid cards show "Your listing"). */
  myLivePublicIds: customerProcedure.query(async ({ ctx }) => {
    const rows = await ctx.tx
      .select({ publicId: listings.publicId })
      .from(listings)
      .where(and(eq(listings.ownerId, ctx.user.id), eq(listings.state, 'LIVE')));
    return rows.map((r) => r.publicId).filter((id): id is string => !!id);
  }),

  saved: router({
    /** Save a LIVE property (idempotent; owner cannot save their own — §20, §30). */
    save: customerProcedure
      .input(z.object({ publicId: z.string().max(40) }))
      .mutation(async ({ ctx, input }) => {
        const listing = await loadLiveListing(ctx.tx, input.publicId);
        if (!listing)
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'This property is no longer available.',
          });
        if (listing.ownerId === ctx.user.id)
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'You cannot save your own listing.',
          });
        await ctx.tx
          .insert(savedProperties)
          .values({ customerId: ctx.user.id, listingId: listing.id })
          .onConflictDoNothing();
        await ctx.tx.insert(auditEvents).values({
          actorId: ctx.user.id,
          action: 'PROPERTY_SAVED',
          entityType: 'listing',
          entityId: listing.id,
          metadata: {},
        });
        return { saved: true as const };
      }),
    remove: customerProcedure
      .input(z.object({ publicId: z.string().max(40) }))
      .mutation(async ({ ctx, input }) => {
        const [l] = await ctx.tx
          .select({ id: listings.id })
          .from(listings)
          .where(eq(listings.publicId, input.publicId))
          .limit(1);
        if (l) {
          await ctx.tx
            .delete(savedProperties)
            .where(
              and(eq(savedProperties.customerId, ctx.user.id), eq(savedProperties.listingId, l.id)),
            );
          await ctx.tx.insert(auditEvents).values({
            actorId: ctx.user.id,
            action: 'PROPERTY_SAVE_REMOVED',
            entityType: 'listing',
            entityId: l.id,
            metadata: {},
          });
        }
        return { saved: false as const };
      }),
    removeById: customerProcedure
      .input(z.object({ savedId: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        await ctx.tx
          .delete(savedProperties)
          .where(
            and(eq(savedProperties.id, input.savedId), eq(savedProperties.customerId, ctx.user.id)),
          );
        return { removed: true as const };
      }),
    /** The set of LIVE public ids the current customer has saved (for grid heart state). */
    publicIds: customerProcedure.query(async ({ ctx }) => {
      const rows = await ctx.tx
        .select({ publicId: listings.publicId })
        .from(savedProperties)
        .innerJoin(listings, eq(listings.id, savedProperties.listingId))
        .where(and(eq(savedProperties.customerId, ctx.user.id), eq(listings.state, 'LIVE')));
      return rows.map((r) => r.publicId).filter((id): id is string => !!id);
    }),
    isSaved: customerProcedure
      .input(z.object({ publicId: z.string().max(40) }))
      .query(async ({ ctx, input }) => {
        const [l] = await ctx.tx
          .select({ id: listings.id })
          .from(listings)
          .where(eq(listings.publicId, input.publicId))
          .limit(1);
        if (!l) return { saved: false };
        const [s] = await ctx.tx
          .select({ id: savedProperties.id })
          .from(savedProperties)
          .where(
            and(eq(savedProperties.customerId, ctx.user.id), eq(savedProperties.listingId, l.id)),
          )
          .limit(1);
        return { saved: !!s };
      }),
    /** The user's saved properties; LIVE ones as cards, others as safe unavailable stubs (§29). */
    list: customerProcedure.query(async ({ ctx }) => {
      const saves = await ctx.tx
        .select({
          savedId: savedProperties.id,
          listingId: savedProperties.listingId,
          savedAt: savedProperties.createdAt,
        })
        .from(savedProperties)
        .where(eq(savedProperties.customerId, ctx.user.id))
        .orderBy(desc(savedProperties.createdAt));
      type SavedItem =
        | {
            kind: 'available';
            savedId: string;
            savedAt: string;
            card: ReturnType<typeof toPublicCard>;
          }
        | { kind: 'unavailable'; savedId: string; savedAt: string };
      const items: SavedItem[] = [];
      for (const s of saves) {
        const [row] = await ctx.tx
          .select()
          .from(mv)
          .where(
            eq(mv.publicId, sql`(select public_id from public.listings where id = ${s.listingId})`),
          )
          .limit(1);
        if (row)
          items.push({
            kind: 'available',
            savedId: s.savedId,
            savedAt: s.savedAt.toISOString(),
            card: toPublicCard(toRow(row)),
          });
        else
          items.push({ kind: 'unavailable', savedId: s.savedId, savedAt: s.savedAt.toISOString() });
      }
      return items;
    }),
  }),
});
