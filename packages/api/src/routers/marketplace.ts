import { and, asc, desc, eq, gte, ilike, lte, or, sql, type SQL } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
  BATHS_OPTIONS,
  BEDS_OPTIONS,
  MARKETPLACE_PRICE_BANDS,
  PROPERTY_TYPES,
  marketplaceQuerySchema,
  paginate,
  type MarketplaceQuery,
} from '@markaz/domain';
import {
  listings,
  savedProperties,
  auditEvents,
  marketplaceListings as mv,
  type Tx,
} from '@markaz/db';
import { toPublicCard, toPublicDetail, type PublicListingRow } from '../public-projection';
import { router, publicTxProcedure, customerProcedure } from '../trpc';

type FacetDimension = 'propertyType' | 'emirate' | 'community' | 'price' | 'bedrooms' | 'baths';

/** Filter conditions over the public marketplace view (LIVE-only by construction). */
function buildConditions(
  input: MarketplaceQuery,
  omit: ReadonlySet<FacetDimension> = new Set(),
): SQL[] {
  const c: SQL[] = [];
  if (!omit.has('propertyType') && input.propertyType) {
    c.push(eq(mv.propertyType, input.propertyType));
  }
  if (!omit.has('emirate') && input.emirate) c.push(eq(mv.emirate, input.emirate));
  if (!omit.has('community') && input.area) c.push(ilike(mv.community, `%${input.area}%`));
  if (!omit.has('price') && input.minPrice != null) {
    c.push(gte(mv.askingPrice, String(input.minPrice)));
  }
  if (!omit.has('price') && input.maxPrice != null) {
    c.push(lte(mv.askingPrice, String(input.maxPrice)));
  }
  if (input.minSize != null) c.push(gte(mv.sizeSqft, String(input.minSize)));
  if (input.maxSize != null) c.push(lte(mv.sizeSqft, String(input.maxSize)));
  if (input.furnishing) c.push(eq(mv.furnishingStatus, input.furnishing));
  if (input.completion) c.push(eq(mv.completionStatus, input.completion));
  if (!omit.has('bedrooms')) {
    if (input.bedrooms === 'studio') c.push(eq(mv.bedrooms, 0));
    else if (input.bedrooms) c.push(gte(mv.bedrooms, Number(input.bedrooms)));
  }
  if (!omit.has('baths') && input.baths) c.push(gte(mv.bathrooms, Number(input.baths)));
  if (input.investmentCase) c.push(eq(mv.icVisible, true));
  if (input.location) {
    const like = `%${input.location}%`;
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

const facetCountSchema = z.object({
  value: z.string(),
  count: z.coerce.number().int().nonnegative(),
});

type FacetCount = z.infer<typeof facetCountSchema>;
type FacetRow = {
  property_types: unknown;
  emirates: unknown;
  communities: unknown;
  bedrooms: unknown;
  baths: unknown;
  price_bands: unknown;
};

function whereFragment(conditions: SQL[]) {
  const condition = conditions.length ? and(...conditions) : undefined;
  return condition ? sql`where ${condition}` : sql.empty();
}

function parseFacetCounts(value: unknown): FacetCount[] {
  return z.array(facetCountSchema).parse(value ?? []);
}

function completeFacetCounts(order: readonly string[], counts: FacetCount[]): FacetCount[] {
  const byValue = new Map(counts.map((item) => [item.value, item.count]));
  return order.map((value) => ({ value, count: byValue.get(value) ?? 0 }));
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
  /** Small public-safe set for the landing page; avoids loading a full search page. */
  featured: publicTxProcedure.query(async ({ ctx }) => {
    const rows = await ctx.tx
      .select()
      .from(mv)
      .orderBy(desc(mv.publishedAt), asc(mv.publicId))
      .limit(3);
    return rows.map((row) => toPublicCard(toRow(row)));
  }),

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

  /**
   * Inventory-aware public facets. Each dimension ignores its own active
   * filter, so the UI can show viable alternatives without loading every row
   * into JavaScript. This is one SQL statement over the security-barrier view.
   */
  facets: publicTxProcedure.input(marketplaceQuerySchema).query(async ({ ctx, input }) => {
    const typeWhere = whereFragment(buildConditions(input, new Set(['propertyType'])));
    const emirateWhere = whereFragment(buildConditions(input, new Set(['emirate'])));
    const communityWhere = whereFragment([
      ...buildConditions(input, new Set(['community'])),
      sql`${mv.community} is not null and btrim(${mv.community}) <> ''`,
    ]);
    const bedroomsWhere = whereFragment([
      ...buildConditions(input, new Set(['bedrooms'])),
      sql`${mv.bedrooms} is not null`,
    ]);
    const bathsWhere = whereFragment([
      ...buildConditions(input, new Set(['baths'])),
      sql`${mv.bathrooms} is not null`,
    ]);
    const priceWhere = whereFragment([
      ...buildConditions(input, new Set(['price'])),
      sql`${mv.askingPrice} is not null`,
    ]);

    const under1m = MARKETPLACE_PRICE_BANDS.under1m.maxPrice;
    const from1m = MARKETPLACE_PRICE_BANDS['1to3m'].minPrice;
    const under3m = MARKETPLACE_PRICE_BANDS['1to3m'].maxPrice;
    const from3m = MARKETPLACE_PRICE_BANDS['3to5m'].minPrice;
    const under5m = MARKETPLACE_PRICE_BANDS['3to5m'].maxPrice;
    const from5m = MARKETPLACE_PRICE_BANDS['5plus'].minPrice;

    const rows = await ctx.tx.execute(
      sql<FacetRow>`
        select
          coalesce((
            select jsonb_agg(type_counts)
            from (
              select ${mv.propertyType}::text as value, count(*)::int as count
              from ${mv}
              ${typeWhere}
              group by ${mv.propertyType}
              order by ${mv.propertyType}
            ) type_counts
          ), '[]'::jsonb) as property_types,
          coalesce((
            select jsonb_agg(emirate_counts)
            from (
              select ${mv.emirate}::text as value, count(*)::int as count
              from ${mv}
              ${emirateWhere}
              group by ${mv.emirate}
              order by ${mv.emirate}
            ) emirate_counts
          ), '[]'::jsonb) as emirates,
          coalesce((
            select jsonb_agg(community_counts)
            from (
              select ${mv.community}::text as value, count(*)::int as count
              from ${mv}
              ${communityWhere}
              group by ${mv.community}
              order by ${mv.community}
            ) community_counts
          ), '[]'::jsonb) as communities,
          (
            select jsonb_build_array(
              jsonb_build_object(
                'value', 'studio',
                'count', (count(*) filter (where ${mv.bedrooms} = 0))::int
              ),
              jsonb_build_object(
                'value', '1',
                'count', (count(*) filter (where ${mv.bedrooms} >= 1))::int
              ),
              jsonb_build_object(
                'value', '2',
                'count', (count(*) filter (where ${mv.bedrooms} >= 2))::int
              ),
              jsonb_build_object(
                'value', '3',
                'count', (count(*) filter (where ${mv.bedrooms} >= 3))::int
              ),
              jsonb_build_object(
                'value', '4',
                'count', (count(*) filter (where ${mv.bedrooms} >= 4))::int
              ),
              jsonb_build_object(
                'value', '5',
                'count', (count(*) filter (where ${mv.bedrooms} >= 5))::int
              )
            )
            from ${mv}
            ${bedroomsWhere}
          ) as bedrooms,
          (
            select jsonb_build_array(
              jsonb_build_object(
                'value', '1',
                'count', (count(*) filter (where ${mv.bathrooms} >= 1))::int
              ),
              jsonb_build_object(
                'value', '2',
                'count', (count(*) filter (where ${mv.bathrooms} >= 2))::int
              ),
              jsonb_build_object(
                'value', '3',
                'count', (count(*) filter (where ${mv.bathrooms} >= 3))::int
              ),
              jsonb_build_object(
                'value', '4',
                'count', (count(*) filter (where ${mv.bathrooms} >= 4))::int
              )
            )
            from ${mv}
            ${bathsWhere}
          ) as baths,
          (
            select jsonb_build_array(
              jsonb_build_object(
                'value', 'under1m',
                'count',
                (count(*) filter (where ${mv.askingPrice}::numeric <= ${under1m}))::int
              ),
              jsonb_build_object(
                'value', '1to3m',
                'count',
                (
                  count(*) filter (
                    where ${mv.askingPrice}::numeric >= ${from1m}
                      and ${mv.askingPrice}::numeric <= ${under3m}
                  )
                )::int
              ),
              jsonb_build_object(
                'value', '3to5m',
                'count',
                (
                  count(*) filter (
                    where ${mv.askingPrice}::numeric >= ${from3m}
                      and ${mv.askingPrice}::numeric <= ${under5m}
                  )
                )::int
              ),
              jsonb_build_object(
                'value', '5plus',
                'count',
                (count(*) filter (where ${mv.askingPrice}::numeric >= ${from5m}))::int
              )
            )
            from ${mv}
            ${priceWhere}
          ) as price_bands
      `,
    );

    const row = rows[0];
    const priceBandOrder = Object.keys(MARKETPLACE_PRICE_BANDS);
    return {
      propertyTypes: completeFacetCounts(PROPERTY_TYPES, parseFacetCounts(row?.property_types)),
      emirates: parseFacetCounts(row?.emirates),
      communities: parseFacetCounts(row?.communities),
      bedrooms: completeFacetCounts(BEDS_OPTIONS, parseFacetCounts(row?.bedrooms)),
      baths: completeFacetCounts(BATHS_OPTIONS, parseFacetCounts(row?.baths)),
      priceBands: completeFacetCounts(priceBandOrder, parseFacetCounts(row?.price_bands)),
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
