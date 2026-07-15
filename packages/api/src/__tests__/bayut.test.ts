import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  BAYUT_API_HOST,
  clearBayutCacheForTests,
  loadBayutFeaturedProperties,
} from '../integrations/bayut';

const enabledEnv = {
  BAYUT_API_MODE: 'rapidapi',
  BAYUT_API_KEY: 'test-secret',
} as NodeJS.ProcessEnv;

function apiProperty(overrides: Record<string, unknown> = {}) {
  return {
    id: 123456,
    title: 'Two-bedroom apartment in Dubai Marina',
    title_ar: 'شقة بغرفتي نوم في دبي مارينا',
    price: 2_450_000,
    type: { sub: 'Apartment', sub_ar: 'شقة' },
    area: { built_up: 1328 },
    details: { bedrooms: 2, bathrooms: 3 },
    location: {
      city: { name: 'Dubai', name_ar: 'دبي' },
      community: { name: 'Dubai Marina', name_ar: 'دبي مارينا' },
    },
    media: { cover_photo: 'https://images.bayut.com/test.jpg' },
    meta: { url: 'https://www.bayut.com/property/details-123456.html' },
    verification: { is_verified: true },
    // These upstream fields must not escape the explicit public projection.
    agent: { name: 'Agent Name', phone: '+97100000000' },
    description: 'Raw provider description',
    permit_number: 'permit-1',
    ...overrides,
  };
}

function responseFetch(payload: unknown, status = 200) {
  return vi.fn(async (_input: unknown, _init?: RequestInit) =>
    Promise.resolve(
      new Response(JSON.stringify(payload), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  );
}

beforeEach(() => clearBayutCacheForTests());

describe('BayutAPI featured-property adapter', () => {
  it('is disabled by default and makes no network request', async () => {
    const fetchMock = responseFetch({ results: [apiProperty()] });

    const result = await loadBayutFeaturedProperties({
      locale: 'en',
      limit: 6,
      env: {} as NodeJS.ProcessEnv,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    expect(result).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('requires the API key only when the integration is enabled', async () => {
    await expect(
      loadBayutFeaturedProperties({
        locale: 'en',
        limit: 6,
        env: { BAYUT_API_MODE: 'rapidapi' } as NodeJS.ProcessEnv,
      }),
    ).rejects.toMatchObject({ code: 'CONFIGURATION_MISSING' });
  });

  it('uses the fixed RapidAPI host and returns only the public card allowlist', async () => {
    const fetchMock = responseFetch({ results: [apiProperty()] });

    const [card] = await loadBayutFeaturedProperties({
      locale: 'en',
      limit: 6,
      env: enabledEnv,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [rawUrl, init] = fetchMock.mock.calls[0]!;
    const url = new URL(String(rawUrl));
    const headers = new Headers(init?.headers);
    expect(url.hostname).toBe(BAYUT_API_HOST);
    expect(url.pathname).toBe('/properties_search');
    expect(url.searchParams.get('page')).toBe('0');
    expect(url.searchParams.get('langs')).toBe('en');
    expect(init?.method).toBe('POST');
    expect(headers.get('X-RapidAPI-Host')).toBe(BAYUT_API_HOST);
    expect(headers.get('X-RapidAPI-Key')).toBe('test-secret');
    expect(JSON.parse(String(init?.body))).toMatchObject({
      purpose: 'for-sale',
      categories: ['residential'],
      locations_ids: [2],
      index: 'latest',
    });
    expect(card).toEqual({
      source: 'BAYUT_API',
      providerId: '123456',
      title: 'Two-bedroom apartment in Dubai Marina',
      askingPriceAed: 2_450_000,
      propertyType: 'Apartment',
      emirate: 'Dubai',
      community: 'Dubai Marina',
      bedrooms: 2,
      bathrooms: 3,
      sizeSqft: 1328,
      coverUrl: 'https://images.bayut.com/test.jpg',
      externalUrl: 'https://www.bayut.com/property/details-123456.html',
      verified: true,
    });
    expect(card).not.toHaveProperty('agent');
    expect(card).not.toHaveProperty('description');
    expect(card).not.toHaveProperty('permit_number');
  });

  it('localises labels and rejects provider-controlled URL hosts', async () => {
    const fetchMock = responseFetch({
      results: [
        apiProperty({
          media: { cover_photo: 'https://tracking.example/property.jpg' },
          meta: { url: 'https://phishing.example/property' },
        }),
      ],
    });

    const [card] = await loadBayutFeaturedProperties({
      locale: 'ar',
      limit: 1,
      env: enabledEnv,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    expect(card).toMatchObject({
      title: 'شقة بغرفتي نوم في دبي مارينا',
      propertyType: 'شقة',
      emirate: 'دبي',
      community: 'دبي مارينا',
      coverUrl: null,
      externalUrl: 'https://www.bayut.com/property/details-123456.html',
    });
  });

  it('caches identical requests for one hour to conserve the provider quota', async () => {
    const fetchMock = responseFetch({ results: [apiProperty()] });
    const input = {
      locale: 'en' as const,
      limit: 6,
      env: enabledEnv,
      fetchImpl: fetchMock as unknown as typeof fetch,
    };

    await loadBayutFeaturedProperties({ ...input, now: 1_000 });
    await loadBayutFeaturedProperties({ ...input, now: 2_000 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('uses safe error codes for upstream failures', async () => {
    const fetchMock = responseFetch({ message: 'provider detail must not escape' }, 429);

    await expect(
      loadBayutFeaturedProperties({
        locale: 'en',
        limit: 6,
        env: enabledEnv,
        fetchImpl: fetchMock as unknown as typeof fetch,
      }),
    ).rejects.toMatchObject({ code: 'UPSTREAM_ERROR' });
  });
});
