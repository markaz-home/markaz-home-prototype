import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@markaz/ui';
import { Link } from '@/i18n/navigation';

export interface Column<T> {
  /** Stable id, used for React keys. */
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  align?: 'start' | 'end';
  /** primary = mobile card heading; secondary = kept on tablet + shown as a mobile fact; low = desktop only. */
  priority?: 'primary' | 'secondary' | 'low';
}

/**
 * Admin data table (spec §34). Semantic <table> on desktop; on mobile each row
 * transforms into a record card with a heading + critical facts + a chevron to
 * the detail page. No row checkboxes / bulk actions by design. No horizontal
 * scroll: low-priority columns are simply hidden below their breakpoint.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  rowHref,
  caption,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  rowHref: (row: T) => string;
  caption: string;
}) {
  if (columns.length === 0) return null;
  const primary = columns.find((c) => c.priority === 'primary') ?? columns[0]!;
  const mobileFacts = columns.filter((c) => c !== primary && c.priority !== 'low');

  return (
    <div>
      {/* Desktop / tablet table */}
      <table className="hidden w-full border-collapse text-sm md:table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="text-muted-foreground border-b text-left text-xs uppercase tracking-wide">
            {columns.map((c) => (
              <th
                key={c.id}
                scope="col"
                className={cn(
                  'px-3 py-2 font-medium',
                  c.align === 'end' && 'text-right',
                  c.priority === 'low' && 'hidden lg:table-cell',
                )}
              >
                {c.header}
              </th>
            ))}
            <th scope="col" className="w-8 px-3 py-2">
              <span className="sr-only">{caption}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className="hover:bg-muted/40 group border-b transition-colors">
              {columns.map((c, i) => (
                <td
                  key={c.id}
                  className={cn(
                    'px-3 py-3 align-middle',
                    c.align === 'end' && 'text-right',
                    c.priority === 'low' && 'hidden lg:table-cell',
                  )}
                >
                  {i === 0 ? (
                    <Link
                      href={rowHref(row)}
                      className="text-foreground font-medium hover:underline"
                    >
                      {c.cell(row)}
                    </Link>
                  ) : (
                    c.cell(row)
                  )}
                </td>
              ))}
              <td className="px-3 py-3 text-right">
                <Link
                  href={rowHref(row)}
                  className="text-muted-foreground group-hover:text-foreground inline-flex"
                  aria-label={caption}
                >
                  <ChevronRight className="h-4 w-4 rtl:rotate-180" aria-hidden />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Mobile record cards */}
      <ul className="space-y-3 md:hidden">
        {rows.map((row) => (
          <li key={rowKey(row)}>
            <Link
              href={rowHref(row)}
              className="bg-card hover:bg-muted/40 flex items-start justify-between gap-3 rounded-lg border p-4"
            >
              <div className="min-w-0 space-y-2">
                <div className="font-medium">{primary.cell(row)}</div>
                <dl className="text-muted-foreground space-y-1 text-sm">
                  {mobileFacts.map((c) => (
                    <div key={c.id} className="flex gap-2">
                      <dt className="shrink-0">{c.header}:</dt>
                      <dd className="text-foreground min-w-0">{c.cell(row)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <ChevronRight
                className="text-muted-foreground mt-1 h-4 w-4 shrink-0 rtl:rotate-180"
                aria-hidden
              />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
