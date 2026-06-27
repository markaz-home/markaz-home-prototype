import type { Locale } from './config';

const intlLocale: Record<Locale, string> = {
  en: 'en-AE',
  ar: 'ar-AE',
};

function resolve(locale: string): string {
  return intlLocale[locale as Locale] ?? 'en-AE';
}

/** AED currency formatting, locale-aware. */
export function formatAed(amount: number, locale: string): string {
  return new Intl.NumberFormat(resolve(locale), {
    style: 'currency',
    currency: 'AED',
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Locale-aware number. */
export function formatNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(resolve(locale)).format(value);
}

/** Locale-aware date. */
export function formatDate(
  value: Date | string | number,
  locale: string,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' },
): string {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat(resolve(locale), options).format(date);
}
