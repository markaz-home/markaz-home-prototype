import { describe, expect, it } from 'vitest';
import {
  filterExternalBrowseCards,
  type ExternalBrowseCard,
} from '@/components/marketplace/external-browse';

function card(overrides: Partial<ExternalBrowseCard> = {}): ExternalBrowseCard {
  return {
    source: 'BAYUT_API',
    providerId: 'apartment-1',
    title: 'Apartment in Dubai Marina',
    askingPriceAed: 2_000_000,
    category: 'APARTMENT',
    propertyType: 'Apartments',
    emirate: 'Dubai',
    community: 'Dubai Marina',
    bedrooms: 2,
    bathrooms: 2,
    sizeSqft: 1_200,
    coverUrl: 'https://images.bayut.com/apartment.jpg',
    externalUrl: 'https://www.bayut.com/property/details-1.html',
    verified: true,
    ...overrides,
  };
}

describe('external browse selection', () => {
  const apartment = card();
  const villa = card({
    providerId: 'villa-1',
    title: 'Villa in Dubai Hills',
    askingPriceAed: 6_000_000,
    category: 'VILLA',
    propertyType: 'Villas',
    community: 'Dubai Hills Estate',
    bedrooms: 4,
    bathrooms: 5,
    sizeSqft: 4_200,
  });

  it('applies the browse property-type and numeric filters to selected external cards', () => {
    expect(
      filterExternalBrowseCards([apartment, villa], {
        type: 'VILLA',
        beds: '4',
        minPrice: '5000000',
      }).map((item) => item.providerId),
    ).toEqual(['villa-1']);
  });

  it('supports search and sort without mutating the cached provider order', () => {
    const cards = [villa, apartment];
    expect(
      filterExternalBrowseCards(cards, { q: 'dubai', sort: 'PRICE_ASC' }).map(
        (item) => item.providerId,
      ),
    ).toEqual(['apartment-1', 'villa-1']);
    expect(cards.map((item) => item.providerId)).toEqual(['villa-1', 'apartment-1']);
  });

  it('hides the selected external feed for filters the provider projection cannot verify', () => {
    expect(filterExternalBrowseCards([apartment, villa], { furnishing: 'FURNISHED' })).toEqual([]);
    expect(filterExternalBrowseCards([apartment, villa], { page: '2' })).toEqual([]);
  });
});
