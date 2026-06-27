import { getRequestConfig } from 'next-intl/server';
import { routing, loadMessages, isLocale } from '@markaz/i18n';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = requested && isLocale(requested) ? requested : routing.defaultLocale;
  return { locale, messages: loadMessages(locale) };
});
