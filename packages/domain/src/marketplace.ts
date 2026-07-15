import { z } from 'zod';
import { PROPERTY_TYPES, FURNISHING_STATUSES, COMPLETION_STATUSES } from './listing-validation';

/**
 * Public marketplace search / filter / sort (design spec §10.3, §20–22). The
 * schema is shared by the URL-state UI and the server query so validation
 * mirrors. Only PUBLIC fields are searchable/filterable — never unit number,
 * seller identity, or any private data (§20.1, §37).
 */

export const MARKETPLACE_SORTS = ['NEWEST', 'PRICE_ASC', 'PRICE_DESC', 'SIZE_DESC'] as const;
export type MarketplaceSort = (typeof MARKETPLACE_SORTS)[number];
export const DEFAULT_SORT: MarketplaceSort = 'NEWEST';

export const MARKETPLACE_PAGE_SIZE = 24;
export const SEARCH_MAX = 100;

export const BEDS_OPTIONS = ['studio', '1', '2', '3', '4', '5'] as const;
export const BATHS_OPTIONS = ['1', '2', '3', '4'] as const;

const optionalInt = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? undefined : v),
  z.coerce.number().int().min(0).max(999_999_999).optional(),
);

/** The full marketplace query. Coerces from string query params; invalid → omitted. */
export const marketplaceQuerySchema = z
  .object({
    q: z.preprocess(
      (v) => (typeof v === 'string' ? v.trim() : v),
      z.string().max(SEARCH_MAX, 'search_too_long').optional(),
    ),
    type: z.enum(PROPERTY_TYPES).optional(),
    emirate: z.string().trim().max(60).optional(),
    area: z.string().trim().max(120).optional(),
    minPrice: optionalInt,
    maxPrice: optionalInt,
    beds: z.enum(BEDS_OPTIONS).optional(),
    baths: z.enum(BATHS_OPTIONS).optional(),
    minSize: optionalInt,
    maxSize: optionalInt,
    furnishing: z.enum(FURNISHING_STATUSES).optional(),
    completion: z.enum(COMPLETION_STATUSES).optional(),
    investmentCase: z.preprocess((v) => v === 'true' || v === true, z.boolean()).optional(),
    sort: z.enum(MARKETPLACE_SORTS).catch(DEFAULT_SORT).default(DEFAULT_SORT),
    page: z.preprocess(
      (v) => (v === '' || v === null || v === undefined ? 1 : v),
      z.coerce.number().int().min(1).catch(1).default(1),
    ),
  })
  .refine((d) => d.minPrice == null || d.maxPrice == null || d.minPrice <= d.maxPrice, {
    path: ['maxPrice'],
    message: 'price_min_above_max',
  })
  .refine((d) => d.minSize == null || d.maxSize == null || d.minSize <= d.maxSize, {
    path: ['maxSize'],
    message: 'size_min_above_max',
  });

export type MarketplaceQuery = z.infer<typeof marketplaceQuerySchema>;

/**
 * Lenient parse for URL params: drop individually-invalid fields rather than
 * failing the whole query (§10.3 "unknown values ignored/normalised"), but keep
 * range-validation errors so the UI can surface them.
 */
export function parseMarketplaceQuery(raw: Record<string, string | undefined>): MarketplaceQuery {
  const parsed = marketplaceQuerySchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  // Strip only the fields that failed, then re-parse with safe fallbacks.
  const cleaned: Record<string, unknown> = { ...raw };
  for (const issue of parsed.error.issues) {
    const key = issue.path[0];
    if (
      typeof key === 'string' &&
      issue.message !== 'price_min_above_max' &&
      issue.message !== 'size_min_above_max'
    ) {
      delete cleaned[key];
    }
  }
  const second = marketplaceQuerySchema.safeParse(cleaned);
  return second.success ? second.data : { sort: DEFAULT_SORT, page: 1 };
}

/** Translate the `beds` filter to a SQL predicate intent. */
export function bedsFilter(beds?: string): { studioOnly?: boolean; min?: number } | null {
  if (!beds) return null;
  if (beds === 'studio') return { studioOnly: true };
  const n = Number(beds);
  return Number.isFinite(n) ? { min: n } : null;
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
}
export function paginate(
  total: number,
  page: number,
  pageSize = MARKETPLACE_PAGE_SIZE,
): Pagination {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const clamped = Math.min(Math.max(1, page), totalPages);
  return {
    page: clamped,
    pageSize,
    total,
    totalPages,
    hasPrev: clamped > 1,
    hasNext: clamped < totalPages,
  };
}
