import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithIntl } from './test-utils';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href, ...props }: React.ComponentProps<'a'>) => (
    <a href={String(href)} {...props}>
      {children}
    </a>
  ),
}));

import { AccountSetupPrompt } from '@/components/account-setup-prompt';

beforeEach(() => window.localStorage.clear());

describe('AccountSetupPrompt', () => {
  it('offers optional profile steps and can be dismissed per account', async () => {
    const user = userEvent.setup();
    renderWithIntl(
      <AccountSetupPrompt userId="customer-1" hasMobile={false} uaePassLinked={false} />,
    );

    expect(
      await screen.findByRole('heading', { name: 'Finish setting up your account' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Add mobile number')).not.toBeInTheDocument();
    expect(screen.queryByText('Link UAE PASS')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Complete profile' })).toHaveAttribute(
      'href',
      '/account/profile',
    );

    await user.click(screen.getByRole('button', { name: 'Maybe later' }));
    expect(
      screen.queryByRole('heading', { name: 'Finish setting up your account' }),
    ).not.toBeInTheDocument();
    expect(window.localStorage.getItem('markaz.account-setup.v1.customer-1')).toBe('dismissed');
  });

  it('does not render once both optional steps are complete', () => {
    renderWithIntl(<AccountSetupPrompt userId="customer-2" hasMobile uaePassLinked />);

    expect(
      screen.queryByRole('heading', { name: 'Finish setting up your account' }),
    ).not.toBeInTheDocument();
  });
});
