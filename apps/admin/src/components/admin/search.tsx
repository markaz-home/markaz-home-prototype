'use client';
import { useState, useRef, useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Search as SearchIcon, X } from 'lucide-react';
import { Input } from '@markaz/ui';
import { Link } from '@/i18n/navigation';
import { trpc } from '@/trpc/react';

/** List text-search box — submits `?query=` (resets offset), preserving other params. */
export function SearchBox({ placeholder }: { placeholder: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get('query') ?? '');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const sp = new URLSearchParams(params.toString());
    if (value.trim()) sp.set('query', value.trim());
    else sp.delete('query');
    sp.delete('offset');
    router.push(`${pathname}?${sp.toString()}`);
  }

  return (
    <form onSubmit={submit} className="relative w-full max-w-xs">
      <SearchIcon
        className="text-muted-foreground pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 rtl:end-3 rtl:start-auto"
        aria-hidden
      />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="ps-9"
        aria-label={placeholder}
      />
    </form>
  );
}

/**
 * Global Search (spec §37) — combobox querying customers/listings/transactions.
 * Debounced; grouped results; each result links to its detail page. References
 * (publicId / reference) render LTR.
 */
export function GlobalSearch() {
  const t = useTranslations('admin');
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<Array<HTMLAnchorElement | null>>([]);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(q), 250);
    return () => clearTimeout(id);
  }, [q]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const enabled = debounced.trim().length >= 2;
  const res = trpc.admin.search.query.useQuery({ q: debounced.trim() }, { enabled });
  const groups = res.data;
  const empty =
    enabled &&
    !res.isLoading &&
    groups &&
    groups.customers.length + groups.listings.length + groups.transactions.length === 0;
  const optionCount = groups
    ? groups.customers.length + groups.listings.length + groups.transactions.length
    : 0;
  const popupOpen = open && q.length > 0;

  useEffect(() => {
    setActiveIndex(-1);
    optionRefs.current = [];
  }, [debounced, optionCount]);

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (!open) {
      if (event.key === 'ArrowDown' && q) {
        event.preventDefault();
        setOpen(true);
        if (optionCount > 0) setActiveIndex(0);
      }
      return;
    }
    if (optionCount === 0) {
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex((current) => {
        if (current < 0) return delta > 0 ? 0 : optionCount - 1;
        return (current + delta + optionCount) % optionCount;
      });
      return;
    }
    if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();
      optionRefs.current[activeIndex]?.click();
    }
  }

  function clear() {
    setQ('');
    setDebounced('');
    setOpen(false);
    setActiveIndex(-1);
    inputRef.current?.focus();
  }

  return (
    <div ref={boxRef} className="relative w-full max-w-md">
      <div className="relative">
        <SearchIcon
          className="text-muted-foreground pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 rtl:end-3 rtl:start-auto"
          aria-hidden
        />
        <Input
          ref={inputRef}
          role="combobox"
          aria-expanded={popupOpen}
          aria-controls={popupOpen ? 'global-search-results' : undefined}
          aria-activedescendant={
            popupOpen && activeIndex >= 0 ? `global-search-option-${activeIndex}` : undefined
          }
          aria-autocomplete="list"
          value={q}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            setActiveIndex(-1);
          }}
          placeholder={t('search.placeholder')}
          className="pe-9 ps-9"
          aria-label={t('search.placeholder')}
        />
        {q ? (
          <button
            type="button"
            onClick={clear}
            className="text-muted-foreground hover:text-foreground absolute end-2 top-1/2 -translate-y-1/2 rounded p-1"
            aria-label={t('search.clear')}
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
      </div>
      {popupOpen ? (
        <div
          id="global-search-results"
          role="listbox"
          className="bg-popover absolute z-20 mt-1 w-full rounded-md border p-2 text-sm shadow-md"
        >
          {!enabled ? (
            <p role="status" className="text-muted-foreground px-2 py-1.5">
              {t('search.hint')}
            </p>
          ) : res.isLoading ? (
            <p role="status" className="text-muted-foreground px-2 py-1.5">
              {t('loading')}
            </p>
          ) : empty ? (
            <p role="status" className="text-muted-foreground px-2 py-1.5">
              {t('search.empty')}
            </p>
          ) : (
            <div>
              <ResultGroup
                title={t('search.groupCustomers')}
                items={groups!.customers}
                hrefFor={(id) => `/customers/${id}`}
                startIndex={0}
                activeIndex={activeIndex}
                optionRefs={optionRefs}
                onActive={setActiveIndex}
                onPick={() => setOpen(false)}
              />
              <ResultGroup
                title={t('search.groupListings')}
                items={groups!.listings}
                hrefFor={(id) => `/listings/${id}`}
                ltr
                startIndex={groups!.customers.length}
                activeIndex={activeIndex}
                optionRefs={optionRefs}
                onActive={setActiveIndex}
                onPick={() => setOpen(false)}
              />
              <ResultGroup
                title={t('search.groupTransactions')}
                items={groups!.transactions}
                hrefFor={(id) => `/transactions/${id}`}
                ltr
                startIndex={groups!.customers.length + groups!.listings.length}
                activeIndex={activeIndex}
                optionRefs={optionRefs}
                onActive={setActiveIndex}
                onPick={() => setOpen(false)}
              />
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function ResultGroup({
  title,
  items,
  hrefFor,
  ltr,
  startIndex,
  activeIndex,
  optionRefs,
  onActive,
  onPick,
}: {
  title: string;
  items: { id: string; label: string | null | undefined }[];
  hrefFor: (id: string) => string;
  ltr?: boolean;
  startIndex: number;
  activeIndex: number;
  optionRefs: React.MutableRefObject<Array<HTMLAnchorElement | null>>;
  onActive: (index: number) => void;
  onPick: () => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="py-1">
      <p className="text-muted-foreground px-2 py-1 text-xs uppercase tracking-wide">{title}</p>
      <ul>
        {items.map((it, itemIndex) => {
          const index = startIndex + itemIndex;
          return (
            <li key={it.id}>
              <Link
                ref={(node) => {
                  optionRefs.current[index] = node;
                }}
                id={`global-search-option-${index}`}
                href={hrefFor(it.id)}
                role="option"
                aria-selected={activeIndex === index}
                onMouseMove={() => onActive(index)}
                onFocus={() => onActive(index)}
                onClick={onPick}
                className={`block rounded px-2 py-1.5 ${
                  activeIndex === index ? 'bg-muted' : 'hover:bg-muted'
                }`}
                dir={ltr ? 'ltr' : undefined}
              >
                {it.label ?? ''}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
