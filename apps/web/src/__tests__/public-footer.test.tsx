import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { loadMessages } from '@markaz/i18n';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@/components/brand-logo', () => ({ BrandLogo: () => <span>Markaz Home</span> }));

import { PublicFooter } from '@/components/marketplace/public-footer';

function renderFooter(isAuthenticated: boolean) {
  return render(
    <NextIntlClientProvider locale="en" messages={loadMessages('en')}>
      <PublicFooter isAuthenticated={isAuthenticated} />
    </NextIntlClientProvider>,
  );
}

describe('PublicFooter', () => {
  it('keeps anonymous journeys and support return paths intact', () => {
    renderFooter(false);

    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse properties' })).toHaveAttribute(
      'href',
      '/properties',
    );
    expect(screen.getByRole('link', { name: 'How it works' })).toHaveAttribute(
      'href',
      '/how-it-works',
    );
    expect(screen.getByRole('link', { name: 'List your property' })).toHaveAttribute(
      'href',
      '/sign-in?next=/sell',
    );
    expect(screen.getByRole('link', { name: /Open support centre/i })).toHaveAttribute(
      'href',
      '/sign-in?next=/account/help',
    );
    expect(screen.getByText(/Markaz Home. All rights reserved/)).toBeInTheDocument();
  });

  it('sends authenticated customers directly to their workspace destinations', () => {
    renderFooter(true);

    expect(screen.getByRole('link', { name: 'List your property' })).toHaveAttribute(
      'href',
      '/sell',
    );
    expect(screen.getByRole('link', { name: 'Your dashboard' })).toHaveAttribute(
      'href',
      '/dashboard',
    );
    expect(screen.getByRole('link', { name: /Open support centre/i })).toHaveAttribute(
      'href',
      '/account/help',
    );
  });
});
