import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithIntl } from './test-utils';

const completeSetupMutate = vi.fn();
const syncIdentityMutate = vi.fn();
const linkIdentity = vi.fn();
const auditMutateAsync = vi.fn().mockResolvedValue({});
const signOut = vi.fn().mockResolvedValue({});
const replace = vi.fn();
let completeSetupOnSuccess: (() => void) | undefined;

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ replace, refresh: vi.fn() }),
  usePathname: () => '/',
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));
vi.mock('@markaz/auth/browser', () => ({
  createSupabaseBrowserClient: () => ({ auth: { signOut, linkIdentity } }),
}));
vi.mock('@/trpc/react', () => ({
  trpc: {
    profile: {
      completeSetup: {
        useMutation: (options?: { onSuccess?: () => void }) => {
          completeSetupOnSuccess = options?.onSuccess;
          return { mutate: completeSetupMutate, isPending: false };
        },
      },
      syncUaePassIdentity: {
        useMutation: () => ({ mutate: syncIdentityMutate, isPending: false }),
      },
    },
    audit: { record: { useMutation: () => ({ mutateAsync: auditMutateAsync }) } },
  },
}));

import { ProfileSetupForm } from '@/components/profile-setup-form';
import { UaePassFlow } from '@/components/uae-pass-flow';

beforeEach(() => {
  completeSetupMutate.mockReset();
  syncIdentityMutate.mockReset();
  linkIdentity.mockReset().mockResolvedValue({ error: null });
  replace.mockReset();
  completeSetupOnSuccess = undefined;
});

describe('ProfileSetupForm', () => {
  it('renders the spec title', () => {
    renderWithIntl(<ProfileSetupForm />);
    expect(screen.getByRole('heading', { name: 'Complete your profile' })).toBeInTheDocument();
  });

  it('blocks submission until name + Terms + Privacy are provided', async () => {
    const user = userEvent.setup();
    renderWithIntl(<ProfileSetupForm />);
    await user.click(screen.getByRole('button', { name: 'Save and continue' }));
    // Appears in both the field error and the error summary.
    expect((await screen.findAllByText('Enter at least 2 characters.')).length).toBeGreaterThan(0);
    expect(completeSetupMutate).not.toHaveBeenCalled();
  });

  it('submits when valid', async () => {
    const user = userEvent.setup();
    renderWithIntl(<ProfileSetupForm />);
    await user.type(screen.getByLabelText(/Full name/i), 'Demo Customer');
    await user.click(screen.getByLabelText(/Terms of Use/i));
    await user.click(screen.getByLabelText(/Privacy Policy/i));
    await user.click(screen.getByRole('button', { name: 'Save and continue' }));
    expect(completeSetupMutate).toHaveBeenCalledTimes(1);
  });

  it('continues a UAE PASS-authenticated customer to the dashboard after profile setup', () => {
    renderWithIntl(<ProfileSetupForm identityAuthenticatedByProvider />);
    completeSetupOnSuccess?.();
    expect(replace).toHaveBeenCalledWith('/dashboard');
  });

  it('continues an email/password customer to identity verification after profile setup', () => {
    renderWithIntl(<ProfileSetupForm />);
    completeSetupOnSuccess?.();
    expect(replace).toHaveBeenCalledWith('/onboarding/uae-pass');
  });
});

describe('UaePassFlow (UAE PASS Staging)', () => {
  it('shows only the UAE PASS staging action when staging is enabled', () => {
    renderWithIntl(<UaePassFlow initialStatus="NOT_STARTED" uaePassStaging />);
    expect(screen.getByRole('heading', { name: 'Verify with UAE PASS' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue with UAE PASS' })).toBeInTheDocument();
    expect(
      screen.getByText('Staging environment — no production verification.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Test identity environment\./)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Start demo verification' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Demo simulation controls')).not.toBeInTheDocument();
  });

  it('shows a configuration message without exposing simulation when staging is disabled', () => {
    renderWithIntl(<UaePassFlow initialStatus="NOT_STARTED" />);
    expect(
      screen.queryByRole('button', { name: 'Continue with UAE PASS' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/UAE PASS identity linking is not available in this environment/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Start demo verification' }),
    ).not.toBeInTheDocument();
  });

  it('links the provider to the signed-in account with an allow-listed return path', async () => {
    const user = userEvent.setup();
    renderWithIntl(<UaePassFlow initialStatus="NOT_STARTED" uaePassStaging locale="ar" />);
    await user.click(screen.getByRole('button', { name: 'Continue with UAE PASS' }));
    expect(linkIdentity).toHaveBeenCalledTimes(1);
    expect(linkIdentity).toHaveBeenCalledWith({
      provider: 'custom:uae-pass',
      options: {
        redirectTo: 'http://localhost:3000/auth/callback?locale=ar&next=%2Fonboarding%2Fuae-pass',
      },
    });
  });

  it('shows a safe recovery message when the identity is already linked elsewhere', async () => {
    linkIdentity.mockResolvedValue({
      error: { code: 'identity_already_exists', message: 'provider detail' },
    });
    const user = userEvent.setup();
    renderWithIntl(<UaePassFlow initialStatus="NOT_STARTED" uaePassStaging locale="en" />);
    await user.click(screen.getByRole('button', { name: 'Continue with UAE PASS' }));
    expect(
      await screen.findByText(/This UAE PASS identity cannot be linked to this Markaz account/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Start demo verification' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('provider detail')).not.toBeInTheDocument();
  });

  it('server-syncs a returned provider identity without a client verification claim', () => {
    renderWithIntl(
      <UaePassFlow initialStatus="NOT_STARTED" providerLinked uaePassStaging locale="en" />,
    );
    expect(syncIdentityMutate).toHaveBeenCalledTimes(1);
    expect(syncIdentityMutate).toHaveBeenCalledWith();
  });

  it('does not expose legacy simulation controls for a pending demo status', () => {
    renderWithIntl(<UaePassFlow initialStatus="PENDING" uaePassStaging />);
    expect(screen.getByRole('button', { name: 'Continue with UAE PASS' })).toBeInTheDocument();
    expect(screen.queryByText('Demo simulation controls')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Approve demo verification' }),
    ).not.toBeInTheDocument();
  });

  it('shows a distinct UAE PASS Staging success result', () => {
    renderWithIntl(<UaePassFlow initialStatus="VERIFIED_STAGING" providerLinked />);
    expect(screen.getAllByText('UAE PASS Staging identity linked').length).toBeGreaterThan(0);
    expect(screen.getByText('Linked · Staging')).toBeInTheDocument();
  });

  it('renders compact Arabic staging copy', () => {
    renderWithIntl(<UaePassFlow initialStatus="NOT_STARTED" uaePassStaging />, 'ar');
    expect(screen.getByRole('heading', { name: 'التحقق عبر UAE PASS' })).toBeInTheDocument();
    expect(screen.getByText(/بيئة اختبار — لا يتم إجراء تحقق إنتاجي/)).toBeInTheDocument();
  });
});
