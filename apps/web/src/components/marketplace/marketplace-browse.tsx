'use client';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { SlidersHorizontal, X } from 'lucide-react';
import { Alert, Button, EmptyState, ErrorState, Skeleton, cn } from '@markaz/ui';
import { usePathname, useRouter } from '@/i18n/navigation';
import { trpc } from '@/trpc/react';
import type { RouterInputs } from '@/trpc/types';
import { PropertyCard } from './property-card';

const PARAM_KEYS = [
  'q', 'type', 'emirate', 'area', 'minPrice', 'maxPrice', 'beds', 'baths',
  'minSize', 'maxSize', 'furnishing', 'completion', 'investmentCase', 'sort', 'page',
] as const;

const PROPERTY_TYPES = ['APARTMENT', 'VILLA', 'TOWNHOUSE', 'PENTHOUSE'] as const;
const BEDS = ['studio', '1', '2', '3', '4', '5'] as const;
const BATHS = ['1', '2', '3', '4'] as const;
const FURNISHINGS = ['FURNISHED', 'UNFURNISHED', 'PARTLY_FURNISHED'] as const;
const COMPLETIONS = ['READY', 'OFF_PLAN'] as const;
const SORTS = [
  ['NEWEST', 'newest'], ['PRICE_ASC', 'priceLow'], ['PRICE_DESC', 'priceHigh'], ['SIZE_DESC', 'sizeLarge'],
] as const;

const selectCls = 'h-10 w-full rounded-md border border-input bg-background px-3 text-sm';

export function MarketplaceBrowse({ isAuthenticated, scope }: { isAuthenticated: boolean; scope: 'uae' | 'dubai' }) {
  const sp = useSearchParams();
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
    for (const k of PARAM_KEYS) {
      const v = sp.get(k);
      if (v) o[k] = v;
    }
    return o;
  }, [sp]);

  const [searchText, setSearchText] = useState(query.q ?? '');

  const search = trpc.marketplace.search.useQuery(query as RouterInputs['marketplace']['search'], {
    staleTime: 0,
    placeholderData: (prev) => prev,
  });
  const savedIds = trpc.marketplace.saved.publicIds.useQuery(undefined, { enabled: isAuthenticated });
  const ownedIds = trpc.marketplace.myLivePublicIds.useQuery(undefined, { enabled: isAuthenticated });
  const savedSet = useMemo(() => new Set(savedIds.data ?? []), [savedIds.data]);
  const ownedSet = useMemo(() => new Set(ownedIds.data ?? []), [ownedIds.data]);

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
  if (query.type) chips.push({ key: 'type', label: tf(`type${titleCase(query.type)}` as 'typeApartment') });
  if (query.beds) chips.push({ key: 'beds', label: query.beds === 'studio' ? tf('studio') : tf('bedsOption', { count: query.beds }) });
  if (query.baths) chips.push({ key: 'baths', label: `${query.baths}+ ${tf('bathrooms')}` });
  if (query.area) chips.push({ key: 'area', label: query.area });
  if (query.minPrice || query.maxPrice) chips.push({ key: 'price', label: `AED ${query.minPrice ?? '0'}–${query.maxPrice ?? '∞'}` });
  if (query.minSize || query.maxSize) chips.push({ key: 'size', label: `${query.minSize ?? '0'}–${query.maxSize ?? '∞'} ${tf('sizeSuffix')}` });
  if (query.furnishing) chips.push({ key: 'furnishing', label: tf(`furnishing${query.furnishing}` as 'furnishingFURNISHED') });
  if (query.completion) chips.push({ key: 'completion', label: tf(`completion${query.completion}` as 'completionREADY') });
  if (query.investmentCase) chips.push({ key: 'investmentCase', label: tf('investment') });

  function removeChip(key: string) {
    if (key === 'price') update({ minPrice: null, maxPrice: null });
    else if (key === 'size') update({ minSize: null, maxSize: null });
    else update({ [key]: null });
  }

  return (
    <div className="container max-w-[1360px] py-8">
      <h1 className="font-display text-3xl font-semibold">{scope === 'dubai' ? t('titleDubai') : t('titleUae')}</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">{t('description')}</p>

      <Alert className="mt-4">
        <p className="font-medium">{t('prototypeTitle')}</p>
        <p className="text-sm text-muted-foreground">{t('prototypeBody')}</p>
      </Alert>

      {/* Search */}
      <form
        className="mt-6 flex max-w-3xl items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          update({ q: searchText.trim() || null });
        }}
      >
        <div className="relative flex-1">
          <label htmlFor="mkt-search" className="sr-only">{t('searchLabel')}</label>
          <input
            id="mkt-search"
            type="search"
            value={searchText}
            maxLength={100}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="h-11 w-full rounded-md border border-input bg-background px-3 pe-10 text-sm"
          />
          {searchText && (
            <button
              type="button"
              aria-label={t('clearSearch')}
              onClick={() => { setSearchText(''); update({ q: null }); }}
              className="absolute end-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
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
          <select className={selectCls} value={query.type ?? ''} onChange={(e) => update({ type: e.target.value || null })}>
            <option value="">{tf('any')}</option>
            {PROPERTY_TYPES.map((v) => <option key={v} value={v}>{tf(`type${titleCase(v)}` as 'typeApartment')}</option>)}
          </select>
        </Field>
        <Field label={tf('bedrooms')}>
          <select className={selectCls} value={query.beds ?? ''} onChange={(e) => update({ beds: e.target.value || null })}>
            <option value="">{tf('any')}</option>
            <option value="studio">{tf('studio')}</option>
            {BEDS.filter((b) => b !== 'studio').map((v) => <option key={v} value={v}>{tf('bedsOption', { count: v })}</option>)}
          </select>
        </Field>
        <Field label={tf('minimumPrice')}>
          <input type="number" inputMode="numeric" min={0} className={selectCls} defaultValue={query.minPrice ?? ''}
            onBlur={(e) => update({ minPrice: e.target.value || null })} />
        </Field>
        <Field label={tf('maximumPrice')}>
          <input type="number" inputMode="numeric" min={0} className={selectCls} defaultValue={query.maxPrice ?? ''}
            onBlur={(e) => update({ maxPrice: e.target.value || null })} />
        </Field>
        <Field label={tf('community')}>
          <input className={selectCls} defaultValue={query.area ?? ''} placeholder={tf('communityPlaceholder')}
            onBlur={(e) => update({ area: e.target.value || null })} />
        </Field>
        <Button type="button" variant="outline" onClick={() => setMoreOpen((v) => !v)} aria-expanded={moreOpen}>
          <SlidersHorizontal className="h-4 w-4 me-2" /> {tf('more')}
        </Button>
      </div>

      {moreOpen && (
        <div className="mt-4 grid gap-3 rounded-md border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label={tf('bathrooms')}>
            <select className={selectCls} value={query.baths ?? ''} onChange={(e) => update({ baths: e.target.value || null })}>
              <option value="">{tf('any')}</option>
              {BATHS.map((v) => <option key={v} value={v}>{tf('bedsOption', { count: v })}</option>)}
            </select>
          </Field>
          <Field label={tf('minimumSize')}>
            <input type="number" inputMode="numeric" min={0} className={selectCls} defaultValue={query.minSize ?? ''}
              onBlur={(e) => update({ minSize: e.target.value || null })} />
          </Field>
          <Field label={tf('maximumSize')}>
            <input type="number" inputMode="numeric" min={0} className={selectCls} defaultValue={query.maxSize ?? ''}
              onBlur={(e) => update({ maxSize: e.target.value || null })} />
          </Field>
          <Field label={tf('furnishing')}>
            <select className={selectCls} value={query.furnishing ?? ''} onChange={(e) => update({ furnishing: e.target.value || null })}>
              <option value="">{tf('any')}</option>
              {FURNISHINGS.map((v) => <option key={v} value={v}>{tf(`furnishing${v}` as 'furnishingFURNISHED')}</option>)}
            </select>
          </Field>
          <Field label={tf('completion')}>
            <select className={selectCls} value={query.completion ?? ''} onChange={(e) => update({ completion: e.target.value || null })}>
              <option value="">{tf('any')}</option>
              {COMPLETIONS.map((v) => <option key={v} value={v}>{tf(`completion${v}` as 'completionREADY')}</option>)}
            </select>
          </Field>
          <label className="flex items-center gap-2 pt-6 text-sm">
            <input type="checkbox" checked={query.investmentCase === 'true'}
              onChange={(e) => update({ investmentCase: e.target.checked ? 'true' : null })} />
            {tf('investment')}
          </label>
        </div>
      )}

      {/* Active chips */}
      {chips.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {chips.map((c) => (
            <button key={c.key} type="button" onClick={() => removeChip(c.key)}
              className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-sm text-secondary-foreground">
              {c.label}
              <X className="h-3 w-3" aria-label={tf('remove', { filter: c.label })} />
            </button>
          ))}
          <Button type="button" variant="link" size="sm" onClick={clearAll}>{tf('clearAll')}</Button>
        </div>
      )}

      {/* Count + sort */}
      <div className="mt-6 flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {fetching
            ? t('updating')
            : data
              ? query.q
                ? t('resultsQuery', { count: data.pagination.total, query: query.q })
                : data.pagination.total === 1
                  ? t('resultsOne')
                  : t('resultsMany', { count: data.pagination.total })
              : ''}
        </p>
        <div className="flex items-center gap-2">
          <label htmlFor="mkt-sort" className="text-sm text-muted-foreground">{ts('label')}</label>
          <select id="mkt-sort" className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={query.sort ?? 'NEWEST'} onChange={(e) => update({ sort: e.target.value })}>
            {SORTS.map(([v, k]) => <option key={v} value={v}>{ts(k)}</option>)}
          </select>
        </div>
      </div>

      {/* Results */}
      <div className="mt-4">
        {search.isLoading ? (
          <Grid>{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="aspect-[4/3] w-full rounded-lg" />)}</Grid>
        ) : search.isError ? (
          <ErrorState title={ter('marketplaceTitle')} description={ter('marketplaceBody')} retryLabel={ter('retry')} onRetry={() => search.refetch()} />
        ) : data && data.items.length === 0 ? (
          <EmptyState
            title={te('resultsTitle')}
            description={query.q ? te('queryBody', { query: query.q }) : te('resultsBody')}
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
          <Button variant="outline" disabled={!data.pagination.hasPrev}
            onClick={() => update({ page: String(data.pagination.page - 1) }, false)}>
            {t('previous')}
          </Button>
          <span className="text-sm text-muted-foreground">
            {t('page', { page: data.pagination.page, total: data.pagination.totalPages })}
          </span>
          <Button variant="outline" disabled={!data.pagination.hasNext}
            onClick={() => update({ page: String(data.pagination.page + 1) }, false)}>
            {t('next')}
          </Button>
        </nav>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex w-full flex-col gap-1 text-sm sm:w-40">
      <span className="font-medium text-muted-foreground">{label}</span>
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
