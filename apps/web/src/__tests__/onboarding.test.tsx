import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithIntl } from './test-utils';

const completeSetupMutate = vi.fn();
const replace = vi.fn();
let completeSetupOnSuccess: (() => void) | undefined;

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ replace, refresh: vi.fn() }),
  usePathname: () => '/',
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
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
    },
  },
}));

import { ProfileSetupForm } from '@/components/profile-setup-form';

beforeEach(() => {
  completeSetupMutate.mockReset();
  replace.mockReset();
  completeSetupOnSuccess = undefined;
});

describe('ProfileSetupForm', () => {
  it('renders the fallback profile form with two-step progress', () => {
    renderWithIntl(<ProfileSetupForm />);
    expect(screen.getByRole('heading', { name: 'Complete your profile' })).toBeInTheDocument();
    expect(screen.getByText(/Step 1 of 2 · Account details/)).toBeInTheDocument();
  });

  it('blocks submission until name + Terms + Privacy are provided', async () => {
    const user = userEvent.setup();
    renderWithIntl(<ProfileSetupForm />);
    await user.click(screen.getByRole('button', { name: 'Save and continue' }));
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

  it('prefills provider details while still requiring MARKAZ consent', async () => {
    const user = userEvent.setup();
    renderWithIntl(
      <ProfileSetupForm
        initialName="UAE PASS Customer"
        email="customer@example.ae"
        emailVerified
      />,
    );
    expect(screen.getByLabelText(/Full name/i)).toHaveValue('UAE PASS Customer');
    expect(screen.getByText('customer@example.ae')).toBeInTheDocument();
    expect(screen.getByText('Verified')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save and continue' }));
    expect(completeSetupMutate).not.toHaveBeenCalled();
  });

  it('continues every completed profile directly to the dashboard', () => {
    renderWithIntl(<ProfileSetupForm />);
    completeSetupOnSuccess?.();
    expect(replace).toHaveBeenCalledWith('/dashboard');
  });
});
