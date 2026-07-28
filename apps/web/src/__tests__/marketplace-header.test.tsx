import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { loadMessages } from '@markaz/i18n';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  usePathname: () => '/',
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock('@/components/language-switcher', () => ({
  LanguageSwitcher: () => <button type="button">Language</button>,
}));

vi.mock('@/components/brand-logo', () => ({ BrandLogo: () => <span>Markaz Home</span> }));

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
  it('offers the three public destinations and both account actions to anonymous visitors', () => {
    renderHeader(false);

    expect(screen.getByRole('link', { name: 'Browse Properties' })).toHaveAttribute(
      'href',
      '/properties',
    );
    expect(screen.getByRole('link', { name: 'How It Works' })).toHaveAttribute(
      'href',
      '/how-it-works',
    );
    // Sellers still land on sign-in with the listing journey preserved.
    expect(screen.getByRole('link', { name: 'For Sellers' })).toHaveAttribute(
      'href',
      '/sign-in?next=/sell',
    );
    expect(screen.getByRole('link', { name: 'Login' })).toHaveAttribute('href', '/sign-in');
    expect(screen.getByRole('link', { name: 'Sign Up' })).toHaveAttribute('href', '/sign-up');
  });

  it('shows customer navigation and sends signed-in visitors directly to listings', async () => {
    const user = userEvent.setup();
    renderHeader(true);

    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/dashboard');
    expect(screen.getByRole('link', { name: 'List a Property' })).toHaveAttribute('href', '/sell');
    expect(screen.queryByRole('link', { name: 'Login' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Sign Up' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Tania Gole/i }));
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  });
});
