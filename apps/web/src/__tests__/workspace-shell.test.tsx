import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { loadMessages } from '@markaz/i18n';

vi.mock('@/i18n/navigation', () => ({
  usePathname: () => '/dashboard',
  Link: ({ children, href, ...props }: React.ComponentProps<'a'>) => (
    <a href={String(href)} {...props}>
      {children}
    </a>
  ),
}));
vi.mock('@/components/language-switcher', () => ({
  LanguageSwitcher: () => <button type="button">Language</button>,
}));
vi.mock('@/components/sign-out-button', () => ({
  SignOutButton: () => <button type="button">Sign out</button>,
}));
vi.mock('@/components/offers/notification-bell', () => ({
  NotificationBell: () => <button type="button">Notifications</button>,
  OffersNavBadge: () => null,
}));
vi.mock('@/components/transactions/shared', () => ({
  TransactionsNavBadge: () => null,
}));

import { WorkspaceShell } from '@/components/workspace-shell';

describe('WorkspaceShell (shared Platform Gold workspace)', () => {
  it('uses the copper wordmark instead of the retired blue workspace logo', () => {
    render(
      <NextIntlClientProvider locale="en" messages={loadMessages('en')}>
        <WorkspaceShell displayName="Tania">
          <div>Dashboard content</div>
        </WorkspaceShell>
      </NextIntlClientProvider>,
    );

    const logos = screen.getAllByAltText('Markaz Home');
    expect(logos.length).toBeGreaterThan(0);
    for (const logo of logos) {
      expect(logo).toHaveAttribute('src', expect.stringContaining('markaz-logo-gold.png'));
      expect(logo).not.toHaveAttribute('src', expect.stringContaining('logo-web.png'));
    }
    expect(screen.getByText('Dashboard content')).toBeInTheDocument();
  });
});
