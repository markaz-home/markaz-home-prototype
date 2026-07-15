import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithIntl } from './test-utils';

const completeSetupMutate = vi.fn();
const setIdentityMutate = vi.fn();
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
  createSupabaseBrowserClient: () => ({ auth: { signOut } }),
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
      setIdentityStatus: { useMutation: () => ({ mutate: setIdentityMutate, isPending: false }) },
    },
    audit: { record: { useMutation: () => ({ mutateAsync: auditMutateAsync }) } },
  },
}));

import { ProfileSetupForm } from '@/components/profile-setup-form';
import { UaePassFlow } from '@/components/uae-pass-flow';

beforeEach(() => {
  completeSetupMutate.mockReset();
  setIdentityMutate.mockReset();
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

  it('continues an email/password customer to simulated identity after profile setup', () => {
    renderWithIntl(<ProfileSetupForm />);
    completeSetupOnSuccess?.();
    expect(replace).toHaveBeenCalledWith('/onboarding/uae-pass');
  });
});

describe('UaePassFlow (simulated UAE PASS, spec §16)', () => {
  it('shows the demo disclosure and start action when not started', () => {
    renderWithIntl(<UaePassFlow initialStatus="NOT_STARTED" />);
    expect(screen.getByText(/Demo simulation only\./)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start demo verification' })).toBeInTheDocument();
  });

  it('moves to PENDING on start', async () => {
    const user = userEvent.setup();
    renderWithIntl(<UaePassFlow initialStatus="NOT_STARTED" />);
    await user.click(screen.getByRole('button', { name: 'Start demo verification' }));
    expect(setIdentityMutate).toHaveBeenCalledWith({ status: 'PENDING' });
  });

  it('shows approve/reject demo controls while pending', () => {
    renderWithIntl(<UaePassFlow initialStatus="PENDING" />);
    expect(screen.getByRole('button', { name: 'Approve demo verification' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument();
  });

  it('shows the exact verified success copy', () => {
    renderWithIntl(<UaePassFlow initialStatus="VERIFIED_DEMO" />);
    expect(screen.getAllByText('Demo identity verified').length).toBeGreaterThan(0);
  });

  it('renders Arabic disclosure', () => {
    renderWithIntl(<UaePassFlow initialStatus="NOT_STARTED" />, 'ar');
    expect(screen.getByText(/محاكاة تجريبية فقط\./)).toBeInTheDocument();
  });
});
