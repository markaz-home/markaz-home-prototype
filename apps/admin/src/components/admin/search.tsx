'use client';
import { useState, useRef, useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Search as SearchIcon } from 'lucide-react';
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
  const boxRef = useRef<HTMLDivElement>(null);

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

  return (
    <div ref={boxRef} className="relative w-full max-w-md">
      <div className="relative">
        <SearchIcon
          className="text-muted-foreground pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 rtl:end-3 rtl:start-auto"
          aria-hidden
        />
        <Input
          role="combobox"
          aria-expanded={open}
          aria-controls="global-search-results"
          value={q}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          placeholder={t('search.placeholder')}
          className="ps-9"
          aria-label={t('search.placeholder')}
        />
      </div>
      {open && q.length > 0 ? (
        <div
          id="global-search-results"
          role="listbox"
          className="bg-popover absolute z-20 mt-1 w-full rounded-md border p-2 text-sm shadow-md"
        >
          {!enabled ? (
            <p className="text-muted-foreground px-2 py-1.5">{t('search.hint')}</p>
          ) : res.isLoading ? (
            <p className="text-muted-foreground px-2 py-1.5">{t('loading')}</p>
          ) : empty ? (
            <p className="text-muted-foreground px-2 py-1.5">{t('search.empty')}</p>
          ) : (
            <>
              <ResultGroup
                title={t('search.groupCustomers')}
                items={groups!.customers}
                hrefFor={(id) => `/customers/${id}`}
                onPick={() => setOpen(false)}
              />
              <ResultGroup
                title={t('search.groupListings')}
                items={groups!.listings}
                hrefFor={(id) => `/listings/${id}`}
                ltr
                onPick={() => setOpen(false)}
              />
              <ResultGroup
                title={t('search.groupTransactions')}
                items={groups!.transactions}
                hrefFor={(id) => `/transactions/${id}`}
                ltr
                onPick={() => setOpen(false)}
              />
            </>
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
  onPick,
}: {
  title: string;
  items: { id: string; label: string | null | undefined }[];
  hrefFor: (id: string) => string;
  ltr?: boolean;
  onPick: () => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="py-1">
      <p className="text-muted-foreground px-2 py-1 text-xs uppercase tracking-wide">{title}</p>
      <ul>
        {items.map((it) => (
          <li key={it.id}>
            <Link
              href={hrefFor(it.id)}
              role="option"
              aria-selected={false}
              onClick={onPick}
              className="hover:bg-muted block rounded px-2 py-1.5"
              dir={ltr ? 'ltr' : undefined}
            >
              {it.label ?? ''}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
