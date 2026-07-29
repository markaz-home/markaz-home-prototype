import 'server-only';
import { z } from 'zod';
import { BAYUT_API_HOST, BayutApiError, getBayutApiMode, type BayutLocale } from './bayut';

const LOCATIONS_URL = `https://${BAYUT_API_HOST}/locations_search`;
const CACHE_TTL_MS = 24 * 60 * 60 * 1_000;
const CACHE_MAX_ENTRIES = 500;
const REQUEST_TIMEOUT_MS = 5_000;
const MAX_RESULTS = 8;

/** Dubai-first prototype: the listing wizard only accepts Dubai properties. */
const DUBAI_CITY_ID = 2;

/**
 * Place levels, coarse to fine. "Area" fields take the first three; a building
 * is a specific tower and belongs in "Building or project" instead.
 */
export const AREA_LEVELS = ['community', 'sub_community', 'cluster'] as const;
export const BUILDING_LEVELS = ['cluster', 'building'] as const;
export type PlaceKind = 'AREA' | 'BUILDING';

const localizedSchema = z
  .object({
    id: z.number().optional(),
    name: z.string().trim().min(1).max(200).nullable().optional(),
    name_ar: z.string().trim().min(1).max(200).nullable().optional(),
  })
  .passthrough();

const resultSchema = z
  .object({
    id: z.union([z.number(), z.string()]),
    name: z.string().trim().min(1).max(200),
    level: z.string().trim().min(1).max(40),
    full: z
      .object({
        city: localizedSchema.nullable().optional(),
        community: localizedSchema.nullable().optional(),
        sub_community: localizedSchema.nullable().optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
  })
  .passthrough();

const responseSchema = z.object({ results: z.array(resultSchema).max(200) });

export interface PlaceSuggestion {
  id: string;
  /** The place itself — what lands in the field when chosen. */
  name: string;
  level: string;
  /** "Dubai Marina · Dubai" — the parent hierarchy, for disambiguation. */
  context: string;
}

interface CacheEntry {
  expiresAt: number;
  items: PlaceSuggestion[];
}
const cache = new Map<string, CacheEntry>();

export function clearLocationCacheForTests() {
  cache.clear();
}

function localized(node: z.infer<typeof localizedSchema> | null | undefined, locale: BayutLocale) {
  if (!node) return null;
  const value = locale === 'ar' ? (node.name_ar ?? node.name) : node.name;
  return value?.trim() || null;
}

/**
 * Type-ahead over the provider's place gazetteer (communities, sub-communities,
 * clusters and towers), scoped to Dubai.
 *
 * Server-only: the RapidAPI key must never reach the browser. Results are cached
 * for a day per (query, locale, kind) — place names are effectively static, and
 * a keystroke-driven field would otherwise burn the request quota.
 */
export async function searchBayutLocations({
  query,
  locale,
  kind = 'AREA',
  fetchImpl = globalThis.fetch,
  env = process.env,
  now = Date.now(),
}: {
  query: string;
  locale: BayutLocale;
  kind?: PlaceKind;
  fetchImpl?: typeof fetch;
  env?: NodeJS.ProcessEnv;
  now?: number;
}): Promise<PlaceSuggestion[]> {
  const term = query.trim();
  if (term.length < 2) return [];
  if (getBayutApiMode(env) !== 'rapidapi') return [];
  const apiKey = env.BAYUT_API_KEY;
  if (!apiKey) throw new BayutApiError('CONFIGURATION_MISSING');

  const cacheKey = `${kind}:${locale}:${term.toLowerCase()}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > now) return cached.items;

  const url = new URL(LOCATIONS_URL);
  url.searchParams.set('query', term);
  url.searchParams.set('langs', locale);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetchImpl(url, {
      headers: { 'X-RapidAPI-Host': BAYUT_API_HOST, 'X-RapidAPI-Key': apiKey },
      signal: controller.signal,
    });
  } catch {
    throw new BayutApiError('NETWORK_FAILURE');
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) throw new BayutApiError('UPSTREAM_ERROR');

  const payload: unknown = await response.json().catch(() => null);
  const parsed = responseSchema.safeParse(payload);
  if (!parsed.success) throw new BayutApiError('INVALID_RESPONSE');

  const wanted: readonly string[] = kind === 'BUILDING' ? BUILDING_LEVELS : AREA_LEVELS;
  const seen = new Set<string>();
  const items: PlaceSuggestion[] = [];
  for (const row of parsed.data.results) {
    if (!wanted.includes(row.level)) continue;
    if (row.full?.city?.id !== DUBAI_CITY_ID) continue;
    const name = localized(row.full?.[row.level as 'community'], locale) ?? row.name;
    const parents = [
      row.level === 'community' ? null : localized(row.full?.community, locale),
      localized(row.full?.city, locale),
    ].filter((part): part is string => !!part && part !== name);
    const key = `${name}|${parents.join('|')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({
      id: String(row.id),
      name,
      level: row.level,
      context: parents.join(' · '),
    });
    if (items.length >= MAX_RESULTS) break;
  }

  // Bounded LRU-ish: place names never change, but the key space is unbounded.
  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(cacheKey, { expiresAt: now + CACHE_TTL_MS, items });
  return items;
}
