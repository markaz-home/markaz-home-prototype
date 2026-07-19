import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { loadMessages } from '@markaz/i18n';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  usePathname: () => '/',
}));

vi.mock('@/components/language-switcher', () => ({
  LanguageSwitcher: () => <button type="button">Language</button>,
}));

vi.mock('@/components/brand-logo', () => ({ BrandLogo: () => <span>MARKAZ Home</span> }));

import { MarketplaceHeader } from '@/components/marketplace/marketplace-header';

function renderHeader(isAuthenticated: boolean) {
  return render(
    <NextIntlClientProvider locale="en" messages={loadMessages('en')}>
      <MarketplaceHeader
        isAuthenticated={isAuthenticated}
        displayName={isAuthenticated ? 'Tania Gole' : null}
      />
    </NextIntlClientProvider>,
  );
}

describe('MarketplaceHeader', () => {
  it('preserves the list-property destination for anonymous visitors', () => {
    renderHeader(false);

    expect(screen.getByRole('link', { name: 'For Sellers' })).toHaveAttribute(
      'href',
      '/sign-in?next=/sell',
    );
    expect(screen.getByRole('link', { name: 'List a Property' })).toHaveAttribute(
      'href',
      '/sign-in?next=/sell',
    );
    expect(screen.getByRole('link', { name: 'Sign In' })).toHaveAttribute('href', '/sign-in');
  });

  it('shows customer navigation and sends signed-in visitors directly to listings', () => {
    renderHeader(true);

    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/dashboard');
    expect(screen.getByRole('link', { name: 'List a Property' })).toHaveAttribute('href', '/sell');
    expect(screen.queryByRole('link', { name: 'Sign In' })).not.toBeInTheDocument();
  });
});
