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
