import { render, type RenderResult } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { loadMessages, type Locale } from '@markaz/i18n';

/** Render a client component inside a next-intl provider for the given locale. */
export function renderWithIntl(ui: React.ReactElement, locale: Locale = 'en'): RenderResult {
  return render(
    <NextIntlClientProvider locale={locale} messages={loadMessages(locale)}>
      {ui}
    </NextIntlClientProvider>,
  );
}
