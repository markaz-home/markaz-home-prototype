import { isLocale, defaultLocale, type Locale } from './config';

export * from './config';
export * from './formats';
export { routing } from './routing';

import enMessages from '../messages/en.json';
import arMessages from '../messages/ar.json';

export type Messages = typeof enMessages;

const catalogues: Record<Locale, Messages> = {
  en: enMessages,
  ar: arMessages as Messages,
};

/** Load the message catalogue for a locale (falls back to the default). */
export function loadMessages(locale: string): Messages {
  return catalogues[isLocale(locale) ? locale : defaultLocale];
}
