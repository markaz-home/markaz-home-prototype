'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { SlidersHorizontal, X } from 'lucide-react';
import {
  BATHS_OPTIONS,
  BEDS_OPTIONS,
  COMPLETION_STATUSES,
  FURNISHING_STATUSES,
  MARKETPLACE_QUERY_PARAM_KEYS,
  MARKETPLACE_SORTS,
  PROPERTY_TYPES,
  type MarketplaceSort,
} from '@markaz/domain';
import { Button, EmptyState, ErrorState, Skeleton, cn } from '@markaz/ui';
import { usePathname, useRouter } from '@/i18n/navigation';
import { trpc } from '@/trpc/react';
import type { RouterInputs } from '@/trpc/types';
import { ExternalPropertyCard } from './external-property-card';
import { shouldShowExternalInventory } from './external-browse';
import { PropertyCard } from './property-card';
import { ListboxSelect } from '@/components/ui/listbox-select';

const SORT_LABEL_KEYS = {
  NEWEST: 'newest',
  PRICE_ASC: 'priceLow',
  PRICE_DESC: 'priceHigh',
  SIZE_DESC: 'sizeLarge',
} as const satisfies Record<MarketplaceSort, 'newest' | 'priceLow' | 'priceHigh' | 'sizeLarge'>;

const selectCls = 'h-10 w-full rounded-md border border-input bg-background px-3 text-sm';

export function MarketplaceBrowse({
  isAuthenticated,
  scope,
}: {
  isAuthenticated: boolean;
  scope: 'uae' | 'dubai';
}) {
  const sp = useSearchParams();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations('marketplace');
  const tf = useTranslations('filters');
  const ts = useTranslations('sort');
  const te = useTranslations('marketplaceEmpty');
  const ter = useTranslations('error');
  const [moreOpen, setMoreOpen] = useState(false);
  const showExternalInventory = shouldShowExternalInventory(isAuthenticated);

  const query = useMemo(() => {
    const o: Record<string, string> = {};
    for (const k of MARKETPLACE_QUERY_PARAM_KEYS) {
      const v = sp.get(k);
      if (v) o[k] = v;
    }
    return o;
  }, [sp]);

  const [searchText, setSearchText] = useState(query.location ?? '');

  // URL state is authoritative. Keep local typing state in sync when the user
  // navigates with Back/Forward or opens a saved filtered URL.
  useEffect(() => {
    setSearchText(query.location ?? '');
  }, [query.location]);

  const search = trpc.marketplace.search.useQuery(query as RouterInputs['marketplace']['search'], {
    staleTime: 0,
    placeholderData: (prev) => prev,
  });
  const facets = trpc.marketplace.facets.useQuery(query as RouterInputs['marketplace']['facets'], {
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });
  const external = trpc.externalProperties.search.useQuery(
    {
      locale: locale === 'ar' ? 'ar' : 'en',
      limit: 12,
      query: query as RouterInputs['marketplace']['search'],
    },
    { enabled: showExternalInventory, staleTime: 60 * 60 * 1_000 },
  );
  const savedIds = trpc.marketplace.saved.publicIds.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const ownedIds = trpc.marketplace.myLivePublicIds.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const savedSet = useMemo(() => new Set(savedIds.data ?? []), [savedIds.data]);
  const ownedSet = useMemo(() => new Set(ownedIds.data ?? []), [ownedIds.data]);
  const externalCards = showExternalInventory ? (external.data?.items ?? []) : [];
  const externalExpected =
    showExternalInventory && (external.isLoading || externalCards.length > 0);
  const propertyTypeCounts = useMemo(
    () => new Map(facets.data?.propertyTypes.map((item) => [item.value, item.count]) ?? []),
    [facets.data?.propertyTypes],
  );
  const bedCounts = useMemo(
    () => new Map(facets.data?.bedrooms.map((item) => [item.value, item.count]) ?? []),
    [facets.data?.bedrooms],
  );
  const bathCounts = useMemo(
    () => new Map(facets.data?.baths.map((item) => [item.value, item.count]) ?? []),
    [facets.data?.baths],
  );

  function update(patch: Record<string, string | null>, resetPage = true) {
    const params = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '') params.delete(k);
      else params.set(k, v);
    }
    if (resetPage && !('page' in patch)) params.delete('page');
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  function clearAll() {
    setSearchText('');
    router.replace(pathname);
  }

  const data = search.data;
  const fetching = search.isFetching && !search.isLoading;

  // Active filter chips (search excluded — it has its own clear control).
  const chips: Array<{ key: string; label: string }> = [];
  if (query.propertyType)
    chips.push({
      key: 'propertyType',
      label: tf(`type${titleCase(query.propertyType)}` as 'typeApartment'),
    });
  if (query.bedrooms)
    chips.push({
      key: 'bedrooms',
      label:
        query.bedrooms === 'studio' ? tf('studio') : tf('bedsOption', { count: query.bedrooms }),
    });
  if (query.baths) chips.push({ key: 'baths', label: `${query.baths}+ ${tf('bathrooms')}` });
  if (query.area) chips.push({ key: 'area', label: query.area });
  if (query.minPrice || query.maxPrice)
    chips.push({ key: 'price', label: `AED ${query.minPrice ?? '0'}–${query.maxPrice ?? '∞'}` });
  if (query.minSize || query.maxSize)
    chips.push({
      key: 'size',
      label: `${query.minSize ?? '0'}–${query.maxSize ?? '∞'} ${tf('sizeSuffix')}`,
    });
  if (query.furnishing)
    chips.push({
      key: 'furnishing',
      label: tf(`furnishing${query.furnishing}` as 'furnishingFURNISHED'),
    });
  if (query.completion)
    chips.push({
      key: 'completion',
      label: tf(`completion${query.completion}` as 'completionREADY'),
    });
  if (query.investmentCase) chips.push({ key: 'investmentCase', label: tf('investment') });

  function removeChip(key: string) {
    if (key === 'price') update({ minPrice: null, maxPrice: null });
    else if (key === 'size') update({ minSize: null, maxSize: null });
    else update({ [key]: null });
  }

  return (
    <div className="container max-w-[1360px] py-8">
      <h1 className="font-display text-3xl font-semibold">
        {scope === 'dubai' ? t('titleDubai') : t('titleUae')}
      </h1>
      {/* Search */}
      <form
        className="mt-6 flex max-w-3xl items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          update({ location: searchText.trim() || null });
        }}
      >
        <div className="relative flex-1">
          <label htmlFor="mkt-search" className="sr-only">
            {t('searchLabel')}
          </label>
          <input
            id="mkt-search"
            type="search"
            value={searchText}
            maxLength={100}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="border-input bg-background h-11 w-full rounded-md border px-3 pe-10 text-sm"
          />
          {searchText && (
            <button
              type="button"
              aria-label={t('clearSearch')}
              onClick={() => {
                setSearchText('');
                update({ location: null });
              }}
              className="text-muted-foreground hover:text-foreground absolute end-2 top-1/2 -translate-y-1/2 rounded p-1"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Button type="submit">{t('searchAction')}</Button>
      </form>

      {/* Primary filters */}
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <Field label={tf('propertyType')}>
          {(labelId) => (
            <ListboxSelect
              labelledBy={labelId}
              value={query.propertyType ?? ''}
              onChange={(v) => update({ propertyType: v || null })}
              options={[
                { value: '', label: tf('any') },
                ...PROPERTY_TYPES.map((v) => ({
                  value: v,
                  label: tf(`type${titleCase(v)}` as 'typeApartment'),
                  count: facets.data ? (propertyTypeCounts.get(v) ?? 0) : undefined,
                  disabled: !!facets.data && (propertyTypeCounts.get(v) ?? 0) === 0,
                })),
              ]}
            />
          )}
        </Field>
        <Field label={tf('bedrooms')}>
          {(labelId) => (
            <ListboxSelect
              labelledBy={labelId}
              value={query.bedrooms ?? ''}
              onChange={(v) => update({ bedrooms: v || null })}
              options={[
                { value: '', label: tf('any') },
                ...BEDS_OPTIONS.map((v) => ({
                  value: v,
                  label: v === 'studio' ? tf('studio') : tf('bedsOption', { count: v }),
                  count: facets.data ? (bedCounts.get(v) ?? 0) : undefined,
                  disabled: !!facets.data && (bedCounts.get(v) ?? 0) === 0,
                })),
              ]}
            />
          )}
        </Field>
        <Field label={tf('minimumPrice')}>
          <input
            key={`min-price-${query.minPrice ?? ''}`}
            type="number"
            inputMode="numeric"
            min={0}
            className={selectCls}
            defaultValue={query.minPrice ?? ''}
            onBlur={(e) => update({ minPrice: e.target.value || null })}
          />
        </Field>
        <Field label={tf('maximumPrice')}>
          <input
            key={`max-price-${query.maxPrice ?? ''}`}
            type="number"
            inputMode="numeric"
            min={0}
            className={selectCls}
            defaultValue={query.maxPrice ?? ''}
            onBlur={(e) => update({ maxPrice: e.target.value || null })}
          />
        </Field>
        {/* No "community or area" field: the search bar above already matches
            community, emirate, building and property type (marketplace.ts §buildConditions),
            so it was a strict subset of the same query. `?area=` links still filter. */}
        <Button
          type="button"
          variant="outline"
          onClick={() => setMoreOpen((v) => !v)}
          aria-expanded={moreOpen}
        >
          <SlidersHorizontal className="me-2 h-4 w-4" /> {tf('more')}
        </Button>
      </div>

      {moreOpen && (
        <div className="bg-card mt-4 grid gap-3 rounded-md border p-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label={tf('bathrooms')}>
            {(labelId) => (
              <ListboxSelect
                labelledBy={labelId}
                value={query.baths ?? ''}
                onChange={(v) => update({ baths: v || null })}
                options={[
                  { value: '', label: tf('any') },
                  ...BATHS_OPTIONS.map((v) => ({
                    value: v,
                    label: tf('bedsOption', { count: v }),
                    count: facets.data ? (bathCounts.get(v) ?? 0) : undefined,
                    disabled: !!facets.data && (bathCounts.get(v) ?? 0) === 0,
                  })),
                ]}
              />
            )}
          </Field>
          <Field label={tf('minimumSize')}>
            <input
              key={`min-size-${query.minSize ?? ''}`}
              type="number"
              inputMode="numeric"
              min={0}
              className={selectCls}
              defaultValue={query.minSize ?? ''}
              onBlur={(e) => update({ minSize: e.target.value || null })}
            />
          </Field>
          <Field label={tf('maximumSize')}>
            <input
              key={`max-size-${query.maxSize ?? ''}`}
              type="number"
              inputMode="numeric"
              min={0}
              className={selectCls}
              defaultValue={query.maxSize ?? ''}
              onBlur={(e) => update({ maxSize: e.target.value || null })}
            />
          </Field>
          <Field label={tf('furnishing')}>
            {(labelId) => (
              <ListboxSelect
                labelledBy={labelId}
                value={query.furnishing ?? ''}
                onChange={(v) => update({ furnishing: v || null })}
                options={[
                  { value: '', label: tf('any') },
                  ...FURNISHING_STATUSES.map((v) => ({
                    value: v,
                    label: tf(`furnishing${v}` as 'furnishingFURNISHED'),
                  })),
                ]}
              />
            )}
          </Field>
          <Field label={tf('completion')}>
            {(labelId) => (
              <ListboxSelect
                labelledBy={labelId}
                value={query.completion ?? ''}
                onChange={(v) => update({ completion: v || null })}
                options={[
                  { value: '', label: tf('any') },
                  ...COMPLETION_STATUSES.map((v) => ({
                    value: v,
                    label: tf(`completion${v}` as 'completionREADY'),
                  })),
                ]}
              />
            )}
          </Field>
          <label className="flex items-center gap-2 pt-6 text-sm">
            <input
              type="checkbox"
              checked={query.investmentCase === 'true'}
              onChange={(e) => update({ investmentCase: e.target.checked ? 'true' : null })}
            />
            {tf('investment')}
          </label>
        </div>
      )}

      {/* Active chips */}
      {chips.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {chips.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => removeChip(c.key)}
              className="bg-secondary text-secondary-foreground inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm"
            >
              {c.label}
              <X className="h-3 w-3" aria-label={tf('remove', { filter: c.label })} />
            </button>
          ))}
          <Button type="button" variant="link" size="sm" onClick={clearAll}>
            {tf('clearAll')}
          </Button>
        </div>
      )}

      {/* Section title + sort. The result count is announced, not shown. */}
      <div className="mt-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="direct-listings-title" className="font-display text-2xl font-semibold">
            {t('directTitle')}
          </h2>
          <p className="sr-only" aria-live="polite">
            {fetching
              ? t('updating')
              : data
                ? query.location
                  ? t('resultsQuery', { count: data.pagination.total, query: query.location })
                  : data.pagination.total === 1
                    ? t('resultsOne')
                    : t('resultsMany', { count: data.pagination.total })
                : ''}
          </p>
        </div>
        <div className="relative flex items-center gap-2">
          <span id="mkt-sort-label" className="text-muted-foreground text-sm">
            {ts('label')}
          </span>
          <div className="relative w-44">
            <ListboxSelect
              id="mkt-sort"
              labelledBy="mkt-sort-label"
              value={query.sort ?? 'NEWEST'}
              onChange={(v) => update({ sort: v })}
              options={MARKETPLACE_SORTS.map((value) => ({
                value,
                label: ts(SORT_LABEL_KEYS[value]),
              }))}
            />
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="mt-4">
        {search.isLoading ? (
          <Grid>
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[4/3] w-full rounded-lg" />
            ))}
          </Grid>
        ) : search.isError ? (
          <ErrorState
            title={ter('marketplaceTitle')}
            description={ter('marketplaceBody')}
            retryLabel={ter('retry')}
            onRetry={() => search.refetch()}
          />
        ) : data && data.items.length === 0 && externalExpected ? (
          <div className="rounded-md border border-dashed p-6">
            <p className="font-medium">{t('directEmptyTitle')}</p>
            <p className="text-muted-foreground mt-1 text-sm">{t('directEmptyBody')}</p>
          </div>
        ) : data && data.items.length === 0 ? (
          <EmptyState
            title={te('resultsTitle')}
            description={
              query.location ? te('queryBody', { query: query.location }) : te('resultsBody')
            }
            action={<Button onClick={clearAll}>{te('clear')}</Button>}
          />
        ) : (
          <Grid className={cn(fetching && 'opacity-60 transition-opacity')}>
            {(data?.items ?? []).map((card) => (
              <PropertyCard
                key={card.publicId}
                card={card}
                isAuthenticated={isAuthenticated}
                saved={card.publicId ? savedSet.has(card.publicId) : false}
                owned={card.publicId ? ownedSet.has(card.publicId) : false}
              />
            ))}
          </Grid>
        )}
      </div>

      {/* Pagination */}
      {data && data.pagination.totalPages > 1 && (
        <nav className="mt-8 flex items-center justify-center gap-4" aria-label="Pagination">
          <Button
            variant="outline"
            disabled={!data.pagination.hasPrev}
            onClick={() => update({ page: String(data.pagination.page - 1) }, false)}
          >
            {t('previous')}
          </Button>
          <span className="text-muted-foreground text-sm">
            {t('page', { page: data.pagination.page, total: data.pagination.totalPages })}
          </span>
          <Button
            variant="outline"
            disabled={!data.pagination.hasNext}
            onClick={() => update({ page: String(data.pagination.page + 1) }, false)}
          >
            {t('next')}
          </Button>
        </nav>
      )}

      {showExternalInventory && (external.isLoading || externalCards.length > 0) && (
        <section className="mt-12" aria-labelledby="external-properties-title">
          <h2 id="external-properties-title" className="font-display text-2xl font-semibold">
            {t('externalTitle')}
          </h2>
          <div className="mt-5">
            {external.isLoading ? (
              <Grid>
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton key={index} className="aspect-[4/3] w-full rounded-lg" />
                ))}
              </Grid>
            ) : (
              <Grid>
                {externalCards.map((card) => (
                  <ExternalPropertyCard key={card.providerId} card={card} />
                ))}
              </Grid>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

/**
 * Filter field. Native controls get a wrapping `<label>`; the listbox (a button,
 * not a labelable control) takes a render prop and is associated by id instead.
 */
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode | ((labelId: string) => React.ReactNode);
}) {
  const labelId = useId();
  if (typeof children === 'function') {
    return (
      <div className="relative flex w-full flex-col gap-1 text-sm sm:w-40">
        <span id={labelId} className="text-muted-foreground font-medium">
          {label}
        </span>
        {children(labelId)}
      </div>
    );
  }
  return (
    <label className="flex w-full flex-col gap-1 text-sm sm:w-40">
      <span className="text-muted-foreground font-medium">{label}</span>
      {children}
    </label>
  );
}

function Grid({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3', className)}>
      {children}
    </div>
  );
}

function titleCase(s: string): string {
  return s.charAt(0) + s.slice(1).toLowerCase();
}
