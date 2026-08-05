'use client';

import { useId, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import {
  BEDS_OPTIONS,
  MARKETPLACE_PRICE_BANDS,
  PROPERTY_TYPES,
  type MarketplacePriceBand,
} from '@markaz/domain';
import { cn } from '@markaz/ui';
import { useRouter } from '@/i18n/navigation';
import { trpc } from '@/trpc/react';
import { ListboxSelect } from '@/components/ui/listbox-select';
import { PlaceCombobox } from '@/components/ui/place-combobox';

const EXTERNAL_FEATURED_LIMIT = 6;

export interface HeroSearchValues {
  location: string;
  propertyType: string;
  price: string;
  bedrooms: string;
}

interface Option {
  value: string;
  label: string;
  count?: number;
  disabled?: boolean;
}

/**
 * Translate the hero's four controls into marketplace query parameters.
 * Exported for unit tests — the mapping is the contract with `/properties`.
 */
export function buildPropertySearchQuery(values: HeroSearchValues): string {
  const params = new URLSearchParams();
  const location = values.location.trim();
  if (location) params.set('location', location);
  if (values.propertyType) params.set('propertyType', values.propertyType);
  if (values.bedrooms) params.set('bedrooms', values.bedrooms);

  const band = MARKETPLACE_PRICE_BANDS[values.price as MarketplacePriceBand];
  if (band) {
    if (band.minPrice !== null) params.set('minPrice', String(band.minPrice));
    if (band.maxPrice !== null) params.set('maxPrice', String(band.maxPrice));
  }
  return params.toString();
}

/**
 * Landing hero search (platform direction §8): one light "glass" bar carrying
 * location, property type, price band, and bedrooms straight into the public
 * marketplace. Dividers use logical properties so the bar mirrors under RTL.
 */
export function HeroSearch() {
  const t = useTranslations('landing');
  const tf = useTranslations('filters');
  const locale = useLocale();
  const router = useRouter();
  const [values, setValues] = useState<HeroSearchValues>({
    location: '',
    propertyType: '',
    price: '',
    bedrooms: '',
  });

  const facets = trpc.marketplace.facets.useQuery(
    {},
    {
      staleTime: 5 * 60 * 1_000,
    },
  );
  // This is deliberately the exact same query key as FeaturedProperties, so
  // React Query shares one provider request across the homepage.
  const external = trpc.externalProperties.featured.useQuery(
    { locale: locale === 'ar' ? 'ar' : 'en', limit: EXTERNAL_FEATURED_LIMIT },
    { staleTime: 60 * 60 * 1_000 },
  );
  const inventoryReady = !!facets.data && !!external.data;
  const typeCounts = useMemo(() => {
    const counts = new Map(
      facets.data?.propertyTypes.map((item) => [item.value, item.count]) ?? [],
    );
    for (const card of external.data?.items ?? []) {
      if (card.category !== 'OTHER') {
        counts.set(card.category, (counts.get(card.category) ?? 0) + 1);
      }
    }
    return counts;
  }, [facets.data?.propertyTypes, external.data?.items]);
  const bedCounts = useMemo(() => {
    const counts = new Map(facets.data?.bedrooms.map((item) => [item.value, item.count]) ?? []);
    for (const card of external.data?.items ?? []) {
      if (card.bedrooms === null) continue;
      const value =
        card.bedrooms === 0 ? 'studio' : card.bedrooms >= 5 ? '5' : String(card.bedrooms);
      if (BEDS_OPTIONS.includes(value as (typeof BEDS_OPTIONS)[number])) {
        counts.set(value, (counts.get(value) ?? 0) + 1);
      }
    }
    return counts;
  }, [facets.data?.bedrooms, external.data?.items]);
  const priceCounts = useMemo(() => {
    const counts = new Map(facets.data?.priceBands.map((item) => [item.value, item.count]) ?? []);
    for (const card of external.data?.items ?? []) {
      const match = Object.entries(MARKETPLACE_PRICE_BANDS).find(([, band]) => {
        const aboveMinimum = band.minPrice === null || card.askingPriceAed >= band.minPrice;
        const belowMaximum = band.maxPrice === null || card.askingPriceAed <= band.maxPrice;
        return aboveMinimum && belowMaximum;
      });
      if (match) counts.set(match[0], (counts.get(match[0]) ?? 0) + 1);
    }
    return counts;
  }, [facets.data?.priceBands, external.data?.items]);

  const set = (key: keyof HeroSearchValues) => (value: string) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const typeOptions: Option[] = [
    { value: '', label: tf('any') },
    ...PROPERTY_TYPES.map((type) => ({
      value: type,
      label: tf(`type${type.charAt(0)}${type.slice(1).toLowerCase()}` as 'typeApartment'),
      count: inventoryReady ? (typeCounts.get(type) ?? 0) : undefined,
      disabled: inventoryReady && (typeCounts.get(type) ?? 0) === 0,
    })),
  ];
  const priceOptions: Option[] = [
    { value: '', label: t('searchPriceAny') },
    {
      value: 'under1m',
      label: t('searchPriceUnder1m'),
      count: inventoryReady ? (priceCounts.get('under1m') ?? 0) : undefined,
      disabled: inventoryReady && (priceCounts.get('under1m') ?? 0) === 0,
    },
    {
      value: '1to3m',
      label: t('searchPrice1to3m'),
      count: inventoryReady ? (priceCounts.get('1to3m') ?? 0) : undefined,
      disabled: inventoryReady && (priceCounts.get('1to3m') ?? 0) === 0,
    },
    {
      value: '3to5m',
      label: t('searchPrice3to5m'),
      count: inventoryReady ? (priceCounts.get('3to5m') ?? 0) : undefined,
      disabled: inventoryReady && (priceCounts.get('3to5m') ?? 0) === 0,
    },
    {
      value: '5plus',
      label: t('searchPrice5plus'),
      count: inventoryReady ? (priceCounts.get('5plus') ?? 0) : undefined,
      disabled: inventoryReady && (priceCounts.get('5plus') ?? 0) === 0,
    },
  ];
  const bedOptions: Option[] = [
    { value: '', label: tf('any') },
    ...BEDS_OPTIONS.map((bed) => ({
      value: bed,
      label: bed === 'studio' ? tf('studio') : tf('bedsOption', { count: bed }),
      count: inventoryReady ? (bedCounts.get(bed) ?? 0) : undefined,
      disabled: inventoryReady && (bedCounts.get(bed) ?? 0) === 0,
    })),
  ];

  function submit() {
    const qs = buildPropertySearchQuery(values);
    router.push(qs ? `/properties?${qs}` : '/properties');
  }

  return (
    <form
      aria-label={t('searchLabel')}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="platform-gold-hero-search w-full max-w-3xl rounded-xl p-2.5 shadow-2xl md:p-3"
    >
      <div className="grid grid-cols-1 items-center gap-2 md:grid-cols-[minmax(0,1.9fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_minmax(0,1fr)_auto] md:gap-3">
        <HeroPlaceField
          label={t('searchLocation')}
          placeholder={t('searchLocationPlaceholder')}
          value={values.location}
          onChange={set('location')}
        />
        <HeroSelect
          label={tf('propertyType')}
          options={typeOptions}
          value={values.propertyType}
          onChange={set('propertyType')}
        />
        <HeroSelect
          label={tf('priceRange')}
          options={priceOptions}
          value={values.price}
          onChange={set('price')}
        />
        <HeroSelect
          label={tf('bedrooms')}
          options={bedOptions}
          value={values.bedrooms}
          onChange={set('bedrooms')}
          last
        />

        <button
          type="submit"
          aria-label={t('searchSubmit')}
          className="mt-1 grid h-11 w-full place-items-center rounded-md bg-[hsl(var(--hero-search-foreground))] text-[hsl(var(--hero-search))] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--hero-search-foreground))] focus-visible:ring-offset-2 md:mt-0 md:w-11"
        >
          <Search className="h-[18px] w-[18px]" aria-hidden />
        </button>
      </div>
    </form>
  );
}

/** Shared shell: micro-label plus an inline-end divider on all but the last field. */
function Field({
  id,
  label,
  last = false,
  children,
}: {
  id: string;
  label: string;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'relative flex min-w-0 flex-col gap-0.5 px-3 py-1',
        !last && 'md:border-e md:border-[hsl(var(--hero-search-foreground)/0.12)]',
      )}
    >
      <label
        htmlFor={id}
        id={`${id}-label`}
        className="text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--hero-search-muted))]"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

const panelCls =
  'absolute inset-x-0 top-[calc(100%+0.5rem)] z-30 max-h-72 overflow-y-auto rounded-lg border border-[hsl(var(--hero-search-foreground)/0.12)] bg-[hsl(var(--hero-search))] py-1.5 shadow-xl';
const optionCls =
  'flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-2 text-start text-sm';

/**
 * The listing form's provider-backed area autocomplete, dressed for the hero.
 * Free text remains available when the provider has no matching place.
 */
function HeroPlaceField({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <Field id={id} label={label}>
      <PlaceCombobox
        id={id}
        kind="AREA"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="h-auto rounded-none border-0 bg-transparent p-0 text-sm font-semibold outline-none placeholder:font-normal placeholder:text-[hsl(var(--hero-search-muted))] focus-visible:ring-0"
        classNames={{
          panel: cn(
            panelCls,
            'inset-e-auto w-[min(20rem,calc(100vw-3rem))] text-[hsl(var(--hero-search-foreground))]',
          ),
          option: 'px-3 py-2 text-start text-sm',
          optionActive: 'bg-[hsl(var(--hero-search-foreground)/0.06)]',
          status: 'text-[hsl(var(--hero-search-muted))]',
        }}
      />
    </Field>
  );
}

/**
 * The shared listbox, dressed for the hero's light "glass" bar: transparent
 * trigger, no border, hero-search palette. Behaviour and ARIA come from
 * `ListboxSelect`, so the hero and the marketplace filters cannot drift apart.
 */
function HeroSelect({
  label,
  options,
  value,
  onChange,
  last = false,
}: {
  label: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  last?: boolean;
}) {
  const id = useId();
  return (
    <Field id={id} label={label} last={last}>
      <ListboxSelect
        id={id}
        labelledBy={`${id}-label`}
        value={value}
        options={options}
        onChange={onChange}
        // The hero's own Field is the positioned ancestor, so the panel spans it.
        wrapperClassName="contents"
        classNames={{
          button:
            'flex w-full items-center justify-between gap-2 bg-transparent text-start text-sm font-semibold outline-none',
          panel: panelCls,
          option: optionCls,
          optionActive: 'bg-[hsl(var(--hero-search-foreground)/0.06)]',
        }}
      />
    </Field>
  );
}
