/** Display formatters for marketplace + listing surfaces. Locale-aware; numbers
 * stay LTR even in RTL layouts (design spec §35). */

/** "AED 2,450,000" — whole dirhams, grouped. */
export function formatAed(value: number | null | undefined, locale = 'en'): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const digits = new Intl.NumberFormat(locale === 'ar' ? 'ar-AE' : 'en-US', {
    maximumFractionDigits: 0,
  }).format(value);
  return `AED ${digits}`;
}

/** "1,328 sq ft" — whole number + suffix (suffix supplied by caller for i18n). */
export function formatNumber(value: number | null | undefined, locale = 'en'): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-AE' : 'en-US', {
    maximumFractionDigits: 0,
  }).format(value);
}

/** "8.4%" — one decimal place (design spec §26.3). */
export function formatPct(value: number | null | undefined, locale = 'en'): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${new Intl.NumberFormat(locale === 'ar' ? 'ar-AE' : 'en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value)}%`;
}

/**
 * "26 Jul 2026, 18:30" — a readable stamp for timelines and expiry lines.
 * Seconds are noise in a negotiation history, and the numeric US default
 * ("7/26/2026, 6:30:36 PM") reads badly in a UAE product.
 */
export function formatDateTime(value: string | Date | null | undefined, locale = 'en'): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-AE' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
