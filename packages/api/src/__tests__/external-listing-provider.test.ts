import { describe, expect, it, vi } from 'vitest';
import type { MarketplaceQuery } from '@markaz/domain';

vi.mock('server-only', () => ({}));

import {
  ExternalListingError,
  deduplicateExternalListings,
  filterExternalListings,
  searchExternalListingProviders,
  selectDiverseExternalListings,
  type ExternalListingCard,
  type ExternalListingProvider,
} from '../integrations/external-listing-provider';

function card(overrides: Partial<ExternalListingCard> = {}): ExternalListingCard {
  return {
    source: 'PROVIDER_A',
    providerId: 'apartment-1',
    title: 'Apartment in Dubai Marina',
    askingPriceAed: 2_000_000,
    category: 'APARTMENT',
    propertyType: 'Apartment',
    emirate: 'Dubai',
    community: 'Dubai Marina',
    bedrooms: 2,
    bathrooms: 2,
    sizeSqft: 1_200,
    coverUrl: 'https://images.example/apartment.jpg',
    externalUrl: 'https://provider.example/apartment-1',
    verified: true,
    ...overrides,
  };
}

function query(overrides: Partial<MarketplaceQuery> = {}): MarketplaceQuery {
  return { sort: 'NEWEST', page: 1, ...overrides };
}

describe('external listing provider contract', () => {
  it('applies the shared marketplace filters to normalised provider cards', () => {
    const apartment = card();
    const villa = card({
      providerId: 'villa-1',
      title: 'Villa in Dubai Hills',
      askingPriceAed: 6_000_000,
      category: 'VILLA',
      propertyType: 'Villa',
      community: 'Dubai Hills Estate',
      bedrooms: 4,
      bathrooms: 5,
      sizeSqft: 4_200,
    });

    expect(
      filterExternalListings(
        [apartment, villa],
        query({ propertyType: 'VILLA', bedrooms: '4', minPrice: 5_000_000 }),
      ).map((item) => item.providerId),
    ).toEqual(['villa-1']);
    expect(
      filterExternalListings(
        [villa, apartment],
        query({ location: 'dubai', sort: 'PRICE_ASC' }),
      ).map((item) => item.providerId),
    ).toEqual(['apartment-1', 'villa-1']);
  });

  it('fails closed for filters the external allow-list cannot verify', () => {
    expect(filterExternalListings([card()], query({ furnishing: 'FURNISHED' }))).toEqual([]);
    expect(filterExternalListings([card()], query({ page: 2 }))).toEqual([]);
  });

  it('deduplicates equivalent units across providers and keeps registry order', () => {
    const first = card();
    const duplicate = card({
      source: 'PROVIDER_B',
      providerId: 'duplicate',
      askingPriceAed: 2_040_000,
      sizeSqft: 1_208,
      coverUrl: 'https://other.example/apartment.jpg',
      externalUrl: 'https://other.example/duplicate',
    });

    expect(deduplicateExternalListings([first, duplicate])).toEqual([first]);
  });

  it('round-robins every supported property category', () => {
    const cards = [
      card({ providerId: 'a1' }),
      card({ providerId: 'a2' }),
      card({ providerId: 'v1', category: 'VILLA' }),
      card({ providerId: 't1', category: 'TOWNHOUSE' }),
      card({ providerId: 'p1', category: 'PENTHOUSE' }),
      card({ providerId: 'o1', category: 'OTHER' }),
    ];

    expect(selectDiverseExternalListings(cards, 6).map((item) => item.providerId)).toEqual([
      'a1',
      'v1',
      't1',
      'p1',
      'o1',
      'a2',
    ]);
  });

  it('makes no network-style call for disabled providers and isolates enabled failures', async () => {
    const disabledSearch = vi.fn();
    const disabled: ExternalListingProvider = {
      id: 'DISABLED',
      mode: () => 'disabled',
      imageHosts: [],
      linkHosts: [],
      search: disabledSearch,
    };
    const failing: ExternalListingProvider = {
      id: 'FAILING',
      mode: () => 'enabled',
      imageHosts: [],
      linkHosts: [],
      search: () => Promise.reject(new ExternalListingError('UPSTREAM_ERROR')),
    };
    const healthy: ExternalListingProvider = {
      id: 'HEALTHY',
      mode: () => 'enabled',
      imageHosts: [],
      linkHosts: [],
      search: () => Promise.resolve([card({ source: 'HEALTHY' })]),
    };

    const result = await searchExternalListingProviders({
      providers: [disabled, failing, healthy],
      params: { locale: 'en', limit: 6 },
      env: {} as NodeJS.ProcessEnv,
    });

    expect(disabledSearch).not.toHaveBeenCalled();
    expect(result.items).toHaveLength(1);
    expect(result.providers).toEqual([
      { id: 'DISABLED', enabled: false, available: false, items: [] },
      {
        id: 'FAILING',
        enabled: true,
        available: false,
        items: [],
        errorCode: 'UPSTREAM_ERROR',
      },
      {
        id: 'HEALTHY',
        enabled: true,
        available: true,
        items: [expect.objectContaining({ source: 'HEALTHY' })],
      },
    ]);
  });
});
