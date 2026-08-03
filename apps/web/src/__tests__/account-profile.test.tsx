import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithIntl } from './test-utils';

const linkIdentity = vi.fn();

vi.mock('@markaz/auth/browser', () => ({
  createSupabaseBrowserClient: () => ({ auth: { linkIdentity } }),
}));

import { AccountProfile } from '@/components/account-profile';

const baseProps = {
  fullName: 'Tania Gole',
  email: 'tania@example.com',
  locale: 'en',
  emailVerified: true,
  uaePassLinked: false,
  uaePassStaging: true,
  initialNotice: null,
} as const;

beforeEach(() => {
  linkIdentity.mockReset().mockResolvedValue({ error: null });
});

describe('AccountProfile', () => {
  it('shows account details and both sign-in methods', () => {
    renderWithIntl(<AccountProfile {...baseProps} />);

    expect(screen.getByRole('heading', { name: 'Profile' })).toBeInTheDocument();
    expect(screen.getByText('Tania Gole')).toBeInTheDocument();
    expect(screen.getAllByText('tania@example.com')).toHaveLength(2);
    expect(screen.getByText('Email and password')).toBeInTheDocument();
    expect(screen.getByText('UAE PASS Staging')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Link UAE PASS Staging' })).toBeInTheDocument();
  });

  it('starts explicit linking for the signed-in account', async () => {
    const user = userEvent.setup();
    renderWithIntl(<AccountProfile {...baseProps} locale="ar" />, 'ar');

    await user.click(screen.getByRole('button', { name: /ربط UAE PASS/ }));
    await waitFor(() => expect(linkIdentity).toHaveBeenCalledTimes(1));
    const request = linkIdentity.mock.calls[0]![0];
    expect(request.provider).toBe('custom:uae-pass');
    expect(request.options.redirectTo).toContain('/auth/callback');
    expect(request.options.redirectTo).toContain('locale=ar');
    expect(request.options.redirectTo).toContain('flow=link');
  });

  it('shows a safe message when the identity already belongs to another user', async () => {
    linkIdentity.mockResolvedValue({ error: { code: 'identity_already_exists' } });
    const user = userEvent.setup();
    renderWithIntl(<AccountProfile {...baseProps} />);

    await user.click(screen.getByRole('button', { name: 'Link UAE PASS Staging' }));
    expect(await screen.findByText('This UAE PASS identity cannot be linked')).toBeInTheDocument();
    expect(screen.getByText(/may already belong to another MARKAZ account/i)).toBeInTheDocument();
  });

  it('shows a linked state without offering another link action', () => {
    renderWithIntl(<AccountProfile {...baseProps} uaePassLinked initialNotice="uae_pass_linked" />);

    expect(screen.getByText('UAE PASS Staging linked')).toBeInTheDocument();
    expect(screen.getByText('Linked')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Link UAE PASS Staging' })).not.toBeInTheDocument();
  });

  it('explains when staging linking is unavailable', () => {
    renderWithIntl(<AccountProfile {...baseProps} uaePassStaging={false} />);
    expect(
      screen.getByText('UAE PASS linking is not available in this environment.'),
    ).toBeInTheDocument();
  });
});
