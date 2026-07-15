import 'server-only';
import { z } from 'zod';

export const BAYUT_API_HOST = 'uae-real-estate2.p.rapidapi.com';
const BAYUT_PROPERTIES_URL = `https://${BAYUT_API_HOST}/properties_search`;
const BAYUT_CACHE_TTL_MS = 60 * 60 * 1_000;
const BAYUT_MAX_FEATURED = 12;

export type BayutApiMode = 'disabled' | 'rapidapi';
export type BayutLocale = 'en' | 'ar';

export interface BayutPropertyCard {
  source: 'BAYUT_API';
  providerId: string;
  title: string;
  askingPriceAed: number;
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

export type BayutApiErrorCode =
  | 'CONFIGURATION_MISSING'
  | 'NETWORK_FAILURE'
  | 'UPSTREAM_ERROR'
  | 'INVALID_RESPONSE';

export class BayutApiError extends Error {
  constructor(readonly code: BayutApiErrorCode) {
    super(code);
    this.name = 'BayutApiError';
  }
}

const nonNegativeNumber = z
  .union([
    z.number(),
    z
      .string()
      .trim()
      .regex(/^\d+(?:\.\d+)?$/),
  ])
  .transform(Number)
  .pipe(z.number().finite().nonnegative());

const localizedNameSchema = z
  .object({
    name: z.string().trim().min(1).max(200).nullable().optional(),
    name_ar: z.string().trim().min(1).max(200).nullable().optional(),
  })
  .passthrough();

const propertySchema = z
  .object({
    id: z.coerce.number().int().positive(),
    title: z.string().trim().min(1).max(500),
    title_ar: z.string().trim().min(1).max(500).nullable().optional(),
    price: nonNegativeNumber,
    type: localizedNameSchema
      .extend({
        sub: z.string().trim().min(1).max(120).nullable().optional(),
        sub_ar: z.string().trim().min(1).max(120).nullable().optional(),
      })
      .nullable()
      .optional(),
    area: z
      .object({ built_up: nonNegativeNumber.nullable().optional() })
      .passthrough()
      .nullable()
      .optional(),
    details: z
      .object({
        bedrooms: z.coerce.number().int().min(0).max(100).nullable().optional(),
        bathrooms: z.coerce.number().int().min(0).max(100).nullable().optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
    location: z
      .object({
        city: localizedNameSchema.nullable().optional(),
        community: localizedNameSchema.nullable().optional(),
        sub_community: localizedNameSchema.nullable().optional(),
        cluster: localizedNameSchema.nullable().optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
    media: z
      .object({ cover_photo: z.string().trim().max(2_000).nullable().optional() })
      .passthrough()
      .nullable()
      .optional(),
    meta: z
      .object({ url: z.string().trim().max(2_000).nullable().optional() })
      .passthrough()
      .nullable()
      .optional(),
    verification: z
      .object({ is_verified: z.boolean().optional() })
      .passthrough()
      .nullable()
      .optional(),
  })
  .passthrough();

const responseSchema = z.object({ results: z.array(z.unknown()) }).passthrough();

type CacheEntry = { expiresAt: number; items: BayutPropertyCard[] };
const cache = new Map<string, CacheEntry>();

export function getBayutApiMode(env: NodeJS.ProcessEnv = process.env): BayutApiMode {
  return env.BAYUT_API_MODE === 'rapidapi' ? 'rapidapi' : 'disabled';
}

export function clearBayutCacheForTests() {
  cache.clear();
}

function allowedHttpsUrl(raw: string | null | undefined, allowedHosts: readonly string[]) {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || !allowedHosts.includes(url.hostname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function localizedName(
  value: z.infer<typeof localizedNameSchema> | null | undefined,
  locale: BayutLocale,
) {
  if (!value) return null;
  return locale === 'ar' ? (value.name_ar ?? value.name ?? null) : (value.name ?? null);
}

function toCard(raw: unknown, locale: BayutLocale): BayutPropertyCard | null {
  const parsed = propertySchema.safeParse(raw);
  if (!parsed.success) return null;
  const p = parsed.data;
  const community =
    localizedName(p.location?.cluster, locale) ??
    localizedName(p.location?.sub_community, locale) ??
    localizedName(p.location?.community, locale);
  const externalUrl =
    allowedHttpsUrl(p.meta?.url, ['bayut.com', 'www.bayut.com']) ??
    `https://www.bayut.com/property/details-${p.id}.html`;
  const coverUrl = allowedHttpsUrl(p.media?.cover_photo, [
    'images.bayut.com',
    'bayut-production.s3.eu-central-1.amazonaws.com',
  ]);

  return {
    source: 'BAYUT_API',
    providerId: String(p.id),
    title: locale === 'ar' ? (p.title_ar ?? p.title) : p.title,
    askingPriceAed: p.price,
    propertyType: locale === 'ar' ? (p.type?.sub_ar ?? p.type?.sub ?? null) : (p.type?.sub ?? null),
    emirate: localizedName(p.location?.city, locale),
    community,
    bedrooms: p.details?.bedrooms ?? null,
    bathrooms: p.details?.bathrooms ?? null,
    sizeSqft: p.area?.built_up ?? null,
    coverUrl,
    externalUrl,
    verified: p.verification?.is_verified === true,
  };
}

export async function loadBayutFeaturedProperties({
  locale,
  limit,
  fetchImpl = globalThis.fetch,
  env = process.env,
  now = Date.now(),
}: {
  locale: BayutLocale;
  limit: number;
  fetchImpl?: typeof fetch;
  env?: NodeJS.ProcessEnv;
  now?: number;
}): Promise<BayutPropertyCard[]> {
  if (getBayutApiMode(env) !== 'rapidapi') return [];
  const apiKey = env.BAYUT_API_KEY;
  if (!apiKey) throw new BayutApiError('CONFIGURATION_MISSING');

  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), BAYUT_MAX_FEATURED);
  const cacheKey = `${locale}:${safeLimit}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > now) return cached.items;

  const url = new URL(BAYUT_PROPERTIES_URL);
  url.searchParams.set('page', '0');
  url.searchParams.set('langs', locale);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5_000);
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-RapidAPI-Host': BAYUT_API_HOST,
        'X-RapidAPI-Key': apiKey,
      },
      body: JSON.stringify({
        purpose: 'for-sale',
        categories: ['residential'],
        locations_ids: [2],
        index: 'latest',
      }),
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
  const items = parsed.data.results
    .map((item) => toCard(item, locale))
    .filter((item): item is BayutPropertyCard => item !== null)
    .slice(0, safeLimit);
  cache.set(cacheKey, { expiresAt: now + BAYUT_CACHE_TTL_MS, items });
  return items;
}
