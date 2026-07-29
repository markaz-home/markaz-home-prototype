/**
 * Display text for third-party (BayutAPI) listings.
 *
 * The provider's own `title` is agent marketing copy — ALL CAPS, typos, promo
 * claims ("4% DLD Waiver | High ROI"), and separator spam ("Best Deal / Prime
 * Location / Iconic Structure"). It is deliberately NOT rendered: we compose the
 * headline from the structured fields instead, in MARKAZ vocabulary and through
 * next-intl, so external cards read consistently beside direct MARKAZ listings.
 * The provider title is still carried in the DTO for text-search matching only.
 */

type Translator = (key: string, values?: Record<string, string | number>) => string;

interface ExternalCardText {
  category: string;
  community: string | null;
}

const PROVIDER_LABEL_KEYS = {
  BAYUT_API: 'featuredSourceBayut',
} as const;

const CATEGORY_LABEL_KEYS: Record<string, string> = {
  APARTMENT: 'typeApartment',
  VILLA: 'typeVilla',
  TOWNHOUSE: 'typeTownhouse',
  PENTHOUSE: 'typePenthouse',
};

/** The badge stays provider-aware without coupling card components to one source. */
export function externalProviderLabelKey(
  source: string,
): 'featuredSourceBayut' | 'featuredSourceExternal' {
  return (
    PROVIDER_LABEL_KEYS[source as keyof typeof PROVIDER_LABEL_KEYS] ?? 'featuredSourceExternal'
  );
}

/** Property type in our own words; unclassified provider types stay generic. */
export function externalTypeLabel(
  category: string,
  filterT: Translator,
  propertyT: Translator,
): string {
  const key = CATEGORY_LABEL_KEYS[category];
  return key ? filterT(key) : propertyT('externalTypeGeneric');
}

/** "Apartment in Sky Gate Tower" — falls back to the type alone with no area. */
export function externalHeadline(
  card: ExternalCardText,
  filterT: Translator,
  propertyT: Translator,
): string {
  const type = externalTypeLabel(card.category, filterT, propertyT);
  return card.community ? propertyT('externalHeadline', { type, area: card.community }) : type;
}
