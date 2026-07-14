import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@markaz/ui';
import { Link } from '@/i18n/navigation';

/** Build a query string, dropping empty values, always resetting offset unless kept. */
export function withParams(
  base: Record<string, string | number | undefined>,
  patch: Record<string, string | number | undefined>,
): string {
  const merged = { ...base, ...patch };
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) {
    if (v !== undefined && v !== '' && v !== null) sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

/** Filter chips (spec §37 Filter Bar). Each option links to the same page with a
 * different filter value; the active one is visually + programmatically marked. */
export function FilterTabs({
  pathname,
  params,
  paramKey,
  active,
  options,
}: {
  pathname: string;
  params: Record<string, string | number | undefined>;
  paramKey: string;
  active: string;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="tablist" aria-label={paramKey}>
      {options.map((o) => {
        const isActive = o.value === active;
        return (
          <Link
            key={o.value}
            href={`${pathname}${withParams(params, { [paramKey]: o.value, offset: 0 })}`}
            role="tab"
            aria-selected={isActive}
            className={cn(
              'rounded-full border px-3 py-1 text-sm transition-colors',
              isActive ? 'border-brand-600 bg-brand-600 text-white' : 'border-input hover:bg-muted',
            )}
          >
            {o.label}
          </Link>
        );
      })}
    </div>
  );
}

/** Page pagination (spec §34) — prev/next by offset. Next is disabled when the
 * current page returned fewer than `limit` rows. */
export function ListPagination({
  pathname,
  params,
  offset,
  limit,
  count,
  labels,
}: {
  pathname: string;
  params: Record<string, string | number | undefined>;
  offset: number;
  limit: number;
  count: number;
  labels: { prev: string; next: string; range: string };
}) {
  const hasPrev = offset > 0;
  const hasNext = count === limit;
  if (!hasPrev && !hasNext) return null;
  return (
    <nav
      className="flex items-center justify-between border-t pt-3 text-sm"
      aria-label="pagination"
    >
      <span className="text-muted-foreground">{labels.range}</span>
      <div className="flex gap-2">
        <PagerLink
          disabled={!hasPrev}
          href={`${pathname}${withParams(params, { offset: Math.max(0, offset - limit) })}`}
        >
          <ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden /> {labels.prev}
        </PagerLink>
        <PagerLink
          disabled={!hasNext}
          href={`${pathname}${withParams(params, { offset: offset + limit })}`}
        >
          {labels.next} <ChevronRight className="h-4 w-4 rtl:rotate-180" aria-hidden />
        </PagerLink>
      </div>
    </nav>
  );
}

function PagerLink({
  disabled,
  href,
  children,
}: {
  disabled: boolean;
  href: string;
  children: React.ReactNode;
}) {
  if (disabled) {
    // A real disabled control — WCAG/axe exempt disabled elements from contrast, and it is
    // correctly removed from the tab order, unlike a greyed-out <span>.
    return (
      <button
        type="button"
        disabled
        className="text-muted-foreground inline-flex cursor-not-allowed items-center gap-1 rounded-md border px-3 py-1.5 opacity-50"
      >
        {children}
      </button>
    );
  }
  return (
    <Link
      href={href}
      className="hover:bg-muted inline-flex items-center gap-1 rounded-md border px-3 py-1.5"
    >
      {children}
    </Link>
  );
}
