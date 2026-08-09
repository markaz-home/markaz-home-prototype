import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithIntl } from './test-utils';

const linkIdentity = vi.fn();
const syncUaePassIdentity = vi.fn();
const updateProfile = vi.fn();
const refresh = vi.fn();

vi.mock('@markaz/auth/browser', () => ({
  createSupabaseBrowserClient: () => ({ auth: { linkIdentity } }),
}));
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ refresh }),
}));
vi.mock('@/trpc/react', () => ({
  trpc: {
    profile: {
      syncUaePassIdentity: {
        useMutation: () => ({ mutate: syncUaePassIdentity }),
      },
      update: {
        useMutation: (options?: {
          onSuccess?: (profile: { fullName: string; phoneE164: string | null }) => void;
        }) => ({
          mutate: (input: { fullName: string; phone: string }) => {
            updateProfile(input);
            options?.onSuccess?.({ fullName: input.fullName, phoneE164: '+971501234567' });
          },
          isPending: false,
        }),
      },
    },
  },
}));

import { AccountProfile } from '@/components/account-profile';

const baseProps = {
  fullName: 'Tania Gole',
  email: 'tania@example.com',
  phoneE164: null,
  phoneVerified: false,
  locale: 'en',
  emailVerified: true,
  emailPasswordLinked: true,
  uaePassLinked: false,
  uaePassSyncPending: false,
  uaePassStaging: true,
  initialNotice: null,
} as const;

beforeEach(() => {
  linkIdentity.mockReset().mockResolvedValue({ error: null });
  syncUaePassIdentity.mockReset();
  updateProfile.mockReset();
  refresh.mockReset();
});

describe('AccountProfile', () => {
  it('shows account details and both sign-in methods', () => {
    renderWithIntl(<AccountProfile {...baseProps} />);

    expect(screen.getByRole('heading', { name: 'Profile' })).toBeInTheDocument();
    expect(screen.getByText('Tania Gole')).toBeInTheDocument();
    expect(screen.getAllByText('tania@example.com')).toHaveLength(2);
    expect(screen.getByText('Email and password')).toBeInTheDocument();
    expect(screen.getAllByText('Verified')).toHaveLength(2);
    expect(screen.getByText('UAE PASS Staging')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Link UAE PASS Staging' })).toBeInTheDocument();
    expect(screen.getByText('Not added')).toBeInTheDocument();
    expect(screen.queryByText('Account type')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Your identities stay attached to one account'),
    ).not.toBeInTheDocument();
  });

  it('shows the verified badge for a provider-only UAE PASS email', () => {
    renderWithIntl(
      <AccountProfile {...baseProps} emailPasswordLinked={false} uaePassLinked emailVerified />,
    );

    expect(screen.getByText('tania@example.com')).toBeInTheDocument();
    expect(screen.getByText('Verified')).toBeInTheDocument();
    expect(screen.queryByText('Email and password')).not.toBeInTheDocument();
  });

  it('edits and normalizes optional mobile contact details', async () => {
    const user = userEvent.setup();
    renderWithIntl(<AccountProfile {...baseProps} />);

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const phone = screen.getByLabelText('Mobile number');
    await user.type(phone, '050 123 4567');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(updateProfile).toHaveBeenCalledWith({
      fullName: 'Tania Gole',
      phone: '050 123 4567',
    });
    expect(await screen.findByText('+971501234567')).toBeInTheDocument();
    expect(screen.getByText('Profile updated')).toBeInTheDocument();
    expect(refresh).toHaveBeenCalledTimes(1);
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

  it('retries the secondary profile record after the linked page renders', async () => {
    renderWithIntl(
      <AccountProfile
        {...baseProps}
        uaePassLinked
        uaePassSyncPending
        initialNotice="uae_pass_linked"
      />,
    );

    await waitFor(() => expect(syncUaePassIdentity).toHaveBeenCalledTimes(1));
  });

  it('never labels a canonical linked identity as an unchanged account', () => {
    renderWithIntl(
      <AccountProfile {...baseProps} uaePassLinked initialNotice="uae_pass_record_error" />,
    );

    expect(screen.getByText('UAE PASS is linked')).toBeInTheDocument();
    expect(screen.getByText(/could not finish updating this profile yet/i)).toBeInTheDocument();
    expect(screen.queryByText("We couldn't link UAE PASS")).not.toBeInTheDocument();
    expect(screen.queryByText(/account has not changed/i)).not.toBeInTheDocument();
  });

  it('explains when staging linking is unavailable', () => {
    renderWithIntl(<AccountProfile {...baseProps} uaePassStaging={false} />);
    expect(
      screen.getByText('UAE PASS linking is not available in this environment.'),
    ).toBeInTheDocument();
  });
});
