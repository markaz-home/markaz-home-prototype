'use client';

import { useMemo, useState } from 'react';
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
import { Alert, Button, EmptyState, ErrorState, Skeleton, cn } from '@markaz/ui';
import { usePathname, useRouter } from '@/i18n/navigation';
import { trpc } from '@/trpc/react';
import type { RouterInputs } from '@/trpc/types';
import { ExternalPropertyCard } from './external-property-card';
import { PropertyCard } from './property-card';

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

  const query = useMemo(() => {
    const o: Record<string, string> = {};
    for (const k of MARKETPLACE_QUERY_PARAM_KEYS) {
      const v = sp.get(k);
      if (v) o[k] = v;
    }
    return o;
  }, [sp]);

  const [searchText, setSearchText] = useState(query.location ?? '');

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
    { staleTime: 60 * 60 * 1_000 },
  );
  const savedIds = trpc.marketplace.saved.publicIds.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const ownedIds = trpc.marketplace.myLivePublicIds.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const savedSet = useMemo(() => new Set(savedIds.data ?? []), [savedIds.data]);
  const ownedSet = useMemo(() => new Set(ownedIds.data ?? []), [ownedIds.data]);
  const externalCards = external.data?.items ?? [];
  const externalExpected = external.isLoading || externalCards.length > 0;
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
      <p className="text-muted-foreground mt-2 max-w-2xl">{t('description')}</p>

      <Alert className="mt-4">
        <p className="font-medium">{t('prototypeTitle')}</p>
        <p className="text-muted-foreground text-sm">{t('prototypeBody')}</p>
      </Alert>

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
          <select
            className={selectCls}
            value={query.propertyType ?? ''}
            onChange={(e) => update({ propertyType: e.target.value || null })}
          >
            <option value="">{tf('any')}</option>
            {PROPERTY_TYPES.map((v) => (
              <option
                key={v}
                value={v}
                disabled={!!facets.data && (propertyTypeCounts.get(v) ?? 0) === 0}
              >
                {tf(`type${titleCase(v)}` as 'typeApartment')}
                {facets.data ? ` (${propertyTypeCounts.get(v) ?? 0})` : ''}
              </option>
            ))}
          </select>
        </Field>
        <Field label={tf('bedrooms')}>
          <select
            className={selectCls}
            value={query.bedrooms ?? ''}
            onChange={(e) => update({ bedrooms: e.target.value || null })}
          >
            <option value="">{tf('any')}</option>
            <option value="studio" disabled={!!facets.data && (bedCounts.get('studio') ?? 0) === 0}>
              {tf('studio')}
              {facets.data ? ` (${bedCounts.get('studio') ?? 0})` : ''}
            </option>
            {BEDS_OPTIONS.filter((b) => b !== 'studio').map((v) => (
              <option key={v} value={v} disabled={!!facets.data && (bedCounts.get(v) ?? 0) === 0}>
                {tf('bedsOption', { count: v })}
                {facets.data ? ` (${bedCounts.get(v) ?? 0})` : ''}
              </option>
            ))}
          </select>
        </Field>
        <Field label={tf('minimumPrice')}>
          <input
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
            type="number"
            inputMode="numeric"
            min={0}
            className={selectCls}
            defaultValue={query.maxPrice ?? ''}
            onBlur={(e) => update({ maxPrice: e.target.value || null })}
          />
        </Field>
        <Field label={tf('community')}>
          <input
            className={selectCls}
            list="marketplace-community-options"
            defaultValue={query.area ?? ''}
            placeholder={tf('communityPlaceholder')}
            onBlur={(e) => update({ area: e.target.value || null })}
          />
          <datalist id="marketplace-community-options">
            {facets.data?.communities.map((item) => (
              <option key={item.value} value={item.value}>
                {item.count}
              </option>
            ))}
          </datalist>
        </Field>
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
            <select
              className={selectCls}
              value={query.baths ?? ''}
              onChange={(e) => update({ baths: e.target.value || null })}
            >
              <option value="">{tf('any')}</option>
              {BATHS_OPTIONS.map((v) => (
                <option
                  key={v}
                  value={v}
                  disabled={!!facets.data && (bathCounts.get(v) ?? 0) === 0}
                >
                  {tf('bedsOption', { count: v })}
                  {facets.data ? ` (${bathCounts.get(v) ?? 0})` : ''}
                </option>
              ))}
            </select>
          </Field>
          <Field label={tf('minimumSize')}>
            <input
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
              type="number"
              inputMode="numeric"
              min={0}
              className={selectCls}
              defaultValue={query.maxSize ?? ''}
              onBlur={(e) => update({ maxSize: e.target.value || null })}
            />
          </Field>
          <Field label={tf('furnishing')}>
            <select
              className={selectCls}
              value={query.furnishing ?? ''}
              onChange={(e) => update({ furnishing: e.target.value || null })}
            >
              <option value="">{tf('any')}</option>
              {FURNISHING_STATUSES.map((v) => (
                <option key={v} value={v}>
                  {tf(`furnishing${v}` as 'furnishingFURNISHED')}
                </option>
              ))}
            </select>
          </Field>
          <Field label={tf('completion')}>
            <select
              className={selectCls}
              value={query.completion ?? ''}
              onChange={(e) => update({ completion: e.target.value || null })}
            >
              <option value="">{tf('any')}</option>
              {COMPLETION_STATUSES.map((v) => (
                <option key={v} value={v}>
                  {tf(`completion${v}` as 'completionREADY')}
                </option>
              ))}
            </select>
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

      {/* Count + sort */}
      <div className="mt-6 flex items-center justify-between gap-4">
        <p className="text-muted-foreground text-sm" aria-live="polite">
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
        <div className="flex items-center gap-2">
          <label htmlFor="mkt-sort" className="text-muted-foreground text-sm">
            {ts('label')}
          </label>
          <select
            id="mkt-sort"
            className="border-input bg-background h-10 rounded-md border px-3 text-sm"
            value={query.sort ?? 'NEWEST'}
            onChange={(e) => update({ sort: e.target.value })}
          >
            {MARKETPLACE_SORTS.map((value) => (
              <option key={value} value={value}>
                {ts(SORT_LABEL_KEYS[value])}
              </option>
            ))}
          </select>
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
          <div className={cn(fetching && 'opacity-60 transition-opacity')}>
            <Grid>
              {data?.items.map((card) => (
                <PropertyCard
                  key={card.publicId}
                  card={card}
                  isAuthenticated={isAuthenticated}
                  saved={card.publicId ? savedSet.has(card.publicId) : false}
                  owned={card.publicId ? ownedSet.has(card.publicId) : false}
                />
              ))}
            </Grid>
          </div>
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

      {(external.isLoading || externalCards.length > 0) && (
        <section className="mt-12" aria-labelledby="external-properties-title">
          <h2 id="external-properties-title" className="font-display text-2xl font-semibold">
            {t('externalTitle')}
          </h2>
          <p className="text-muted-foreground mt-2 max-w-3xl text-sm">{t('externalBody')}</p>
          <div className="mt-5">
            <Grid>
              {external.isLoading
                ? Array.from({ length: 6 }).map((_, index) => (
                    <Skeleton key={index} className="aspect-[4/3] w-full rounded-lg" />
                  ))
                : externalCards.map((card) => (
                    <ExternalPropertyCard key={card.providerId} card={card} />
                  ))}
            </Grid>
          </div>
        </section>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex w-full flex-col gap-1 text-sm sm:w-40">
      <span className="text-muted-foreground font-medium">{label}</span>
      {children}
    </label>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}

function titleCase(s: string): string {
  return s.charAt(0) + s.slice(1).toLowerCase();
}
