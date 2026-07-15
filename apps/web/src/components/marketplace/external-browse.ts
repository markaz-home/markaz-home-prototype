import type { RouterOutputs } from '@/trpc/types';

export type ExternalBrowseCard = RouterOutputs['externalProperties']['featured']['items'][number];

export function filterExternalBrowseCards(
  cards: ExternalBrowseCard[],
  query: Record<string, string>,
) {
  if (query.page && query.page !== '1') return [];
  if (query.furnishing || query.completion || query.investmentCase) return [];

  const text = query.q?.trim().toLowerCase();
  const area = query.area?.trim().toLowerCase();
  const minPrice = numberOrNull(query.minPrice);
  const maxPrice = numberOrNull(query.maxPrice);
  const minSize = numberOrNull(query.minSize);
  const maxSize = numberOrNull(query.maxSize);
  const beds = query.beds === 'studio' ? 0 : numberOrNull(query.beds);
  const baths = numberOrNull(query.baths);

  const filtered = cards.filter((card) => {
    if (query.type && card.category !== query.type) return false;
    if (query.emirate && card.emirate?.toLowerCase() !== query.emirate.toLowerCase()) return false;
    if (beds !== null && card.bedrooms !== beds) return false;
    if (baths !== null && (card.bathrooms === null || card.bathrooms < baths)) return false;
    if (minPrice !== null && card.askingPriceAed < minPrice) return false;
    if (maxPrice !== null && card.askingPriceAed > maxPrice) return false;
    if (minSize !== null && (card.sizeSqft === null || card.sizeSqft < minSize)) return false;
    if (maxSize !== null && (card.sizeSqft === null || card.sizeSqft > maxSize)) return false;
    if (area && !card.community?.toLowerCase().includes(area)) return false;
    if (text) {
      const haystack = [card.title, card.propertyType, card.community, card.emirate]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(text)) return false;
    }
    return true;
  });

  return [...filtered].sort((a, b) => {
    if (query.sort === 'PRICE_ASC') return a.askingPriceAed - b.askingPriceAed;
    if (query.sort === 'PRICE_DESC') return b.askingPriceAed - a.askingPriceAed;
    if (query.sort === 'SIZE_DESC') return (b.sizeSqft ?? 0) - (a.sizeSqft ?? 0);
    return 0;
  });
}

function numberOrNull(value: string | undefined) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
