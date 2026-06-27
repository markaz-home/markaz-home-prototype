import { defineRouting } from 'next-intl/routing';
import { locales, defaultLocale } from './config';

/** Locale-prefixed routing for the web app (/en/..., /ar/...). */
export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: 'always',
});
