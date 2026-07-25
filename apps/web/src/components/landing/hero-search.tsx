'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { cn } from '@markaz/ui';
import { useRouter } from '@/i18n/navigation';
import { dubaiCommunityNames } from '@/lib/dubai-communities';
import { trpc } from '@/trpc/react';

/**
 * Price bands offered on the hero. Each maps to the `minPrice`/`maxPrice` pair
 * the marketplace browse page already reads from the query string, so the hero
 * search is a real filter entry point and not a decorative control.
 */
const PRICE_BANDS = {
  under1m: { maxPrice: '1000000' },
  '1to3m': { minPrice: '1000000', maxPrice: '3000000' },
  '3to5m': { minPrice: '3000000', maxPrice: '5000000' },
  '5plus': { minPrice: '5000000' },
} as const;

type PriceBand = keyof typeof PRICE_BANDS;

const PROPERTY_TYPES = ['APARTMENT', 'VILLA', 'TOWNHOUSE', 'PENTHOUSE'] as const;
const BEDS = ['studio', '1', '2', '3', '4', '5'] as const;
const MAX_SUGGESTIONS = 6;

export interface HeroSearchValues {
  q: string;
  type: string;
  price: string;
  beds: string;
}

interface Option {
  value: string;
  label: string;
}

/**
 * Translate the hero's four controls into marketplace query parameters.
 * Exported for unit tests — the mapping is the contract with `/properties`.
 */
export function buildPropertySearchQuery(values: HeroSearchValues): string {
  const params = new URLSearchParams();
  const q = values.q.trim();
  if (q) params.set('q', q);
  if (values.type) params.set('type', values.type);
  if (values.beds) params.set('beds', values.beds);

  const band = PRICE_BANDS[values.price as PriceBand];
  if (band) {
    if ('minPrice' in band && band.minPrice) params.set('minPrice', band.minPrice);
    if ('maxPrice' in band && band.maxPrice) params.set('maxPrice', band.maxPrice);
  }
  return params.toString();
}

/**
 * Rank place suggestions for what has been typed: matches that start with the
 * term first, then matches anywhere, each alphabetically. A fully typed name
 * still lists itself — dropping it reads as a broken control. Exported for tests.
 */
export function rankPlaceSuggestions(places: string[], term: string): string[] {
  const needle = term.trim().toLowerCase();
  if (!needle) return [];
  const starts: string[] = [];
  const contains: string[] = [];
  for (const place of places) {
    const haystack = place.toLowerCase();
    if (haystack.startsWith(needle)) starts.push(place);
    else if (haystack.includes(needle)) contains.push(place);
  }
  return [...starts.sort(), ...contains.sort()].slice(0, MAX_SUGGESTIONS);
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
    q: '',
    type: '',
    price: '',
    beds: '',
  });

  // Suggestions merge the searchable Dubai areas with the communities that
  // actually appear on MARKAZ inventory. Deliberately no external-provider
  // query here: it would be a second upstream call (a different `limit` key
  // from the featured section) on every page load, for tower names only.
  const filterOptions = trpc.marketplace.getFilterOptions.useQuery(undefined, {
    staleTime: 5 * 60 * 1_000,
  });
  const places = useMemo(() => {
    const all = [...dubaiCommunityNames(locale), ...(filterOptions.data?.communities ?? [])].filter(
      (place): place is string => !!place?.trim(),
    );
    return [...new Set(all)].sort();
  }, [locale, filterOptions.data?.communities]);

  const set = (key: keyof HeroSearchValues) => (value: string) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const typeOptions: Option[] = [
    { value: '', label: tf('any') },
    ...PROPERTY_TYPES.map((type) => ({
      value: type,
      label: tf(`type${type.charAt(0)}${type.slice(1).toLowerCase()}` as 'typeApartment'),
    })),
  ];
  const priceOptions: Option[] = [
    { value: '', label: t('searchPriceAny') },
    { value: 'under1m', label: t('searchPriceUnder1m') },
    { value: '1to3m', label: t('searchPrice1to3m') },
    { value: '3to5m', label: t('searchPrice3to5m') },
    { value: '5plus', label: t('searchPrice5plus') },
  ];
  const bedOptions: Option[] = [
    { value: '', label: tf('any') },
    ...BEDS.map((bed) => ({
      value: bed,
      label: bed === 'studio' ? tf('studio') : tf('bedsOption', { count: bed }),
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
        <PlaceField
          label={t('searchLocation')}
          placeholder={t('searchLocationPlaceholder')}
          value={values.q}
          onChange={set('q')}
          places={places}
        />
        <HeroSelect
          label={tf('propertyType')}
          options={typeOptions}
          value={values.type}
          onChange={set('type')}
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
          value={values.beds}
          onChange={set('beds')}
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

/** Close on outside pointer-down; shared by the combobox and the selects. */
function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) close();
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open, close]);
  return ref;
}

/**
 * Location combobox: suggests communities from real inventory as you type
 * (ARIA 1.2 combobox — list popup, `aria-activedescendant`, free text allowed).
 */
function PlaceField({
  label,
  placeholder,
  value,
  onChange,
  places,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  places: string[];
}) {
  const id = useId();
  const listboxId = `${id}-listbox`;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const suggestions = useMemo(() => rankPlaceSuggestions(places, value), [places, value]);
  const wrapperRef = useDismiss(open, () => setOpen(false));
  const isOpen = open && suggestions.length > 0;

  function choose(place: string) {
    onChange(place);
    setOpen(false);
    setActive(-1);
  }

  return (
    <div ref={wrapperRef} className="contents">
      <Field id={id} label={label}>
        <input
          id={id}
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={isOpen && active >= 0 ? `${listboxId}-${active}` : undefined}
          autoComplete="off"
          value={value}
          placeholder={placeholder}
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setOpen(true);
              setActive((prev) => (prev + 1) % Math.max(suggestions.length, 1));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActive((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1));
            } else if (event.key === 'Enter' && isOpen && active >= 0) {
              // Take the highlighted suggestion instead of submitting the form.
              event.preventDefault();
              choose(suggestions[active]!);
            } else if (event.key === 'Escape' && isOpen) {
              event.preventDefault();
              setOpen(false);
              setActive(-1);
            }
          }}
          className="w-full bg-transparent text-sm font-semibold outline-none placeholder:font-normal placeholder:text-[hsl(var(--hero-search-muted))]"
        />

        {isOpen && (
          <ul id={listboxId} role="listbox" aria-labelledby={`${id}-label`} className={panelCls}>
            {suggestions.map((place, index) => (
              <li
                key={place}
                id={`${listboxId}-${index}`}
                role="option"
                aria-selected={index === active}
                onMouseEnter={() => setActive(index)}
                // Fires before the input's blur, so the value still lands.
                onMouseDown={(event) => {
                  event.preventDefault();
                  choose(place);
                }}
                className={cn(
                  optionCls,
                  index === active && 'bg-[hsl(var(--hero-search-foreground)/0.06)]',
                )}
              >
                {place}
              </li>
            ))}
          </ul>
        )}
      </Field>
    </div>
  );
}

/**
 * Listbox select styled to the hero bar — native `<select>` popups cannot be
 * themed and rendered as a system menu against the light card.
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
  const listboxId = `${id}-listbox`;
  const [open, setOpen] = useState(false);
  const selectedIndex = Math.max(
    options.findIndex((option) => option.value === value),
    0,
  );
  const [active, setActive] = useState(selectedIndex);
  const wrapperRef = useDismiss(open, () => setOpen(false));

  function commit(index: number) {
    const option = options[index];
    if (option) onChange(option.value);
    setOpen(false);
  }

  return (
    <div ref={wrapperRef} className="contents">
      <Field id={id} label={label} last={last}>
        <button
          type="button"
          id={id}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listboxId : undefined}
          aria-labelledby={`${id}-label ${id}`}
          onClick={() => {
            setActive(selectedIndex);
            setOpen((prev) => !prev);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              if (!open) {
                setActive(selectedIndex);
                setOpen(true);
                return;
              }
              setActive((prev) => {
                const next = event.key === 'ArrowDown' ? prev + 1 : prev - 1;
                return (next + options.length) % options.length;
              });
            } else if (open && (event.key === 'Enter' || event.key === ' ')) {
              event.preventDefault();
              commit(active);
            } else if (open && event.key === 'Escape') {
              event.preventDefault();
              setOpen(false);
            }
          }}
          className="flex w-full items-center justify-between gap-2 bg-transparent text-start text-sm font-semibold outline-none"
        >
          <span className="truncate">{options[selectedIndex]?.label}</span>
          <ChevronDown
            className={cn('h-3.5 w-3.5 shrink-0 transition-transform', open && 'rotate-180')}
            aria-hidden
          />
        </button>

        {open && (
          <ul
            id={listboxId}
            role="listbox"
            aria-labelledby={`${id}-label`}
            aria-activedescendant={`${listboxId}-${active}`}
            className={panelCls}
          >
            {options.map((option, index) => (
              <li
                key={option.value || 'any'}
                id={`${listboxId}-${index}`}
                role="option"
                aria-selected={option.value === value}
                onMouseEnter={() => setActive(index)}
                onMouseDown={(event) => {
                  event.preventDefault();
                  commit(index);
                }}
                className={cn(
                  optionCls,
                  index === active && 'bg-[hsl(var(--hero-search-foreground)/0.06)]',
                  option.value === value && 'font-semibold',
                )}
              >
                <span className="truncate">{option.label}</span>
                {option.value === value && <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />}
              </li>
            ))}
          </ul>
        )}
      </Field>
    </div>
  );
}
