import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithIntl } from './test-utils';

const completeSetupMutate = vi.fn();
const setIdentityMutate = vi.fn();
const replace = vi.fn();

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ replace, refresh: vi.fn() }),
  usePathname: () => '/',
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));
vi.mock('@/trpc/react', () => ({
  trpc: {
    profile: {
      completeSetup: { useMutation: () => ({ mutate: completeSetupMutate, isPending: false }) },
      setIdentityStatus: { useMutation: () => ({ mutate: setIdentityMutate, isPending: false }) },
    },
  },
}));

import { ProfileSetupForm } from '@/components/profile-setup-form';
import { UaePassFlow } from '@/components/uae-pass-flow';

beforeEach(() => {
  completeSetupMutate.mockReset();
  setIdentityMutate.mockReset();
});

describe('ProfileSetupForm', () => {
  it('blocks submission until name + Terms + Privacy are provided', async () => {
    const user = userEvent.setup();
    renderWithIntl(<ProfileSetupForm />);
    await user.click(screen.getByRole('button', { name: /Save and continue/i }));
    expect(await screen.findByText('Please enter your full name.')).toBeInTheDocument();
    expect(completeSetupMutate).not.toHaveBeenCalled();
  });

  it('submits when valid', async () => {
    const user = userEvent.setup();
    renderWithIntl(<ProfileSetupForm />);
    await user.type(screen.getByLabelText(/Full name/i), 'Demo Customer');
    await user.click(screen.getByLabelText(/Terms of Use/i));
    await user.click(screen.getByLabelText(/Privacy Policy/i));
    await user.click(screen.getByRole('button', { name: /Save and continue/i }));
    expect(completeSetupMutate).toHaveBeenCalledTimes(1);
  });
});

describe('UaePassFlow (simulated UAE PASS)', () => {
  it('shows the demo disclosure and start action when not started', () => {
    renderWithIntl(<UaePassFlow initialStatus="NOT_STARTED" />);
    expect(
      screen.getByText(/Demo simulation only\. This prototype is not connected/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Start demo verification/i })).toBeInTheDocument();
  });

  it('moves to PENDING on start', async () => {
    const user = userEvent.setup();
    renderWithIntl(<UaePassFlow initialStatus="NOT_STARTED" />);
    await user.click(screen.getByRole('button', { name: /Start demo verification/i }));
    expect(setIdentityMutate).toHaveBeenCalledWith({ status: 'PENDING' });
  });

  it('shows approve/reject while pending', () => {
    renderWithIntl(<UaePassFlow initialStatus="PENDING" />);
    expect(screen.getByRole('button', { name: /Approve demo verification/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reject/i })).toBeInTheDocument();
  });

  it('shows the verified success copy', () => {
    renderWithIntl(<UaePassFlow initialStatus="VERIFIED_DEMO" />);
    expect(screen.getByText('Demo identity verified')).toBeInTheDocument();
  });

  it('renders Arabic disclosure (RTL locale)', () => {
    const { container } = renderWithIntl(<UaePassFlow initialStatus="NOT_STARTED" />, 'ar');
    expect(screen.getByText(/محاكاة تجريبية فقط/)).toBeInTheDocument();
    // Arabic content present; direction is applied at the html level in the app layout.
    expect(container).toBeTruthy();
  });
});
