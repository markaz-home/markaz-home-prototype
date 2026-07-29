import 'server-only';
import { PROPERTY_TYPES, type MarketplaceQuery, type PropertyType } from '@markaz/domain';

export const EXTERNAL_LISTING_CATEGORIES = [...PROPERTY_TYPES, 'OTHER'] as const;
export type ExternalListingCategory = PropertyType | 'OTHER';
export type ExternalListingLocale = 'en' | 'ar';
export type ExternalListingProviderMode = 'disabled' | 'enabled';

export type ExternalListingErrorCode =
  | 'CONFIGURATION_MISSING'
  | 'NETWORK_FAILURE'
  | 'UPSTREAM_ERROR'
  | 'INVALID_RESPONSE';

export class ExternalListingError extends Error {
  constructor(readonly code: ExternalListingErrorCode) {
    super(code);
    this.name = 'ExternalListingError';
  }
}

/**
 * The public allow-list shared by every external inventory adapter. Provider
 * payloads are never returned directly: each adapter must construct this DTO.
 */
export interface ExternalListingCard {
  source: string;
  providerId: string;
  title: string;
  askingPriceAed: number;
  category: ExternalListingCategory;
  propertyType: string | null;
  emirate: string | null;
  community: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  sizeSqft: number | null;
  coverUrl: string | null;
  externalUrl: string;
  verified: boolean;
}

export interface ExternalSearch {
  locale: ExternalListingLocale;
  limit: number;
  query?: MarketplaceQuery;
}

/**
 * A provider owns its upstream host, credentials, URL allow-lists and response
 * normalisation. Callers can supply search values, never an upstream URL.
 */
export interface ExternalListingProvider {
  id: string;
  mode(env?: NodeJS.ProcessEnv): ExternalListingProviderMode;
  imageHosts: readonly string[];
  linkHosts: readonly string[];
  search(params: ExternalSearch, env?: NodeJS.ProcessEnv): Promise<ExternalListingCard[]>;
}

export interface ExternalProviderResult {
  id: string;
  enabled: boolean;
  available: boolean;
  items: ExternalListingCard[];
  errorCode?: ExternalListingErrorCode | 'UNKNOWN';
}

function normalizedKeyPart(value: string | null) {
  return value?.trim().toLocaleLowerCase('en').replace(/\s+/g, ' ') ?? '';
}

/**
 * Approximate identity shared across providers. Price and size are intentionally
 * rounded because two portals frequently carry slightly different snapshots of
 * the same unit.
 */
export function externalPropertySignature(card: ExternalListingCard): string | null {
  if (!card.community) return null;
  if (card.bedrooms === null && card.bathrooms === null && card.sizeSqft === null) return null;

  const roundedSize = card.sizeSqft === null ? '' : Math.round(card.sizeSqft / 25) * 25;
  const roundedPrice = Math.round(card.askingPriceAed / 100_000) * 100_000;
  return [
    card.category,
    normalizedKeyPart(card.community),
    card.bedrooms ?? '',
    card.bathrooms ?? '',
    roundedSize,
    roundedPrice,
  ].join('|');
}

/** Keep the first provider in registry order when equivalent inventory appears twice. */
export function deduplicateExternalListings<T extends ExternalListingCard>(cards: T[]): T[] {
  const unique: T[] = [];
  const seenImages = new Set<string>();
  const seenSignatures = new Set<string>();

  for (const card of cards) {
    const signature = externalPropertySignature(card);
    if (card.coverUrl && seenImages.has(card.coverUrl)) continue;
    if (signature && seenSignatures.has(signature)) continue;
    unique.push(card);
    if (card.coverUrl) seenImages.add(card.coverUrl);
    if (signature) seenSignatures.add(signature);
  }
  return unique;
}

/**
 * Round-robin the complete category vocabulary. Deriving this list from the
 * canonical domain constant prevents newly supported property types from being
 * silently dropped.
 */
export function selectDiverseExternalListings<T extends ExternalListingCard>(
  cards: T[],
  limit: number,
): T[] {
  const safeLimit = Math.max(0, Math.trunc(limit));
  const buckets = EXTERNAL_LISTING_CATEGORIES.map((category) =>
    cards.filter((card) => card.category === category),
  );
  const selected: T[] = [];
  while (selected.length < safeLimit && buckets.some((bucket) => bucket.length > 0)) {
    for (const bucket of buckets) {
      const card = bucket.shift();
      if (card) selected.push(card);
      if (selected.length === safeLimit) break;
    }
  }
  return selected;
}

function numberMatches(
  value: number | null,
  minimum: number | undefined,
  maximum: number | undefined,
) {
  if (minimum !== undefined && (value === null || value < minimum)) return false;
  if (maximum !== undefined && (value === null || value > maximum)) return false;
  return true;
}

/** Apply the MARKAZ marketplace query consistently to every normalised provider DTO. */
export function filterExternalListings<T extends ExternalListingCard>(
  cards: T[],
  query?: MarketplaceQuery,
): T[] {
  if (!query) return [...cards];
  if (query.page > 1) return [];

  // These fields are intentionally absent from the public external DTO. Fail
  // closed rather than presenting results that do not actually satisfy them.
  if (query.furnishing || query.completion || query.investmentCase) return [];

  const text = query.location?.trim().toLocaleLowerCase('en');
  const area = query.area?.trim().toLocaleLowerCase('en');
  const minimumBeds =
    query.bedrooms && query.bedrooms !== 'studio' ? Number(query.bedrooms) : undefined;
  const studioOnly = query.bedrooms === 'studio';
  const minimumBaths = query.baths ? Number(query.baths) : undefined;

  const filtered = cards.filter((card) => {
    if (query.propertyType && card.category !== query.propertyType) return false;
    if (query.emirate && normalizedKeyPart(card.emirate) !== normalizedKeyPart(query.emirate)) {
      return false;
    }
    if (studioOnly && card.bedrooms !== 0) return false;
    if (minimumBeds !== undefined && (card.bedrooms === null || card.bedrooms < minimumBeds)) {
      return false;
    }
    if (minimumBaths !== undefined && (card.bathrooms === null || card.bathrooms < minimumBaths)) {
      return false;
    }
    if (!numberMatches(card.askingPriceAed, query.minPrice, query.maxPrice)) return false;
    if (!numberMatches(card.sizeSqft, query.minSize, query.maxSize)) return false;
    if (area && !card.community?.toLocaleLowerCase('en').includes(area)) return false;
    if (text) {
      const haystack = [card.title, card.propertyType, card.community, card.emirate]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('en');
      if (!haystack.includes(text)) return false;
    }
    return true;
  });

  return filtered.sort((a, b) => {
    if (query.sort === 'PRICE_ASC') return a.askingPriceAed - b.askingPriceAed;
    if (query.sort === 'PRICE_DESC') return b.askingPriceAed - a.askingPriceAed;
    if (query.sort === 'SIZE_DESC') return (b.sizeSqft ?? 0) - (a.sizeSqft ?? 0);
    return 0;
  });
}

export async function searchExternalListingProviders({
  providers,
  params,
  env = process.env,
}: {
  providers: readonly ExternalListingProvider[];
  params: ExternalSearch;
  env?: NodeJS.ProcessEnv;
}) {
  const results = await Promise.all(
    providers.map(async (provider): Promise<ExternalProviderResult> => {
      const enabled = provider.mode(env) === 'enabled';
      if (!enabled) return { id: provider.id, enabled: false, available: false, items: [] };

      try {
        const items = await provider.search(params, env);
        return { id: provider.id, enabled: true, available: true, items };
      } catch (error) {
        return {
          id: provider.id,
          enabled: true,
          available: false,
          items: [],
          errorCode: error instanceof ExternalListingError ? error.code : 'UNKNOWN',
        };
      }
    }),
  );

  const items = selectDiverseExternalListings(
    deduplicateExternalListings(results.flatMap((result) => result.items)),
    params.limit,
  );
  return { providers: results, items };
}
