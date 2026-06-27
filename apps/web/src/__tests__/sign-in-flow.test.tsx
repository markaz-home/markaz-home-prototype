import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithIntl } from './test-utils';

const signInWithOtp = vi.fn();
const verifyOtp = vi.fn();
const replace = vi.fn();
const refresh = vi.fn();

vi.mock('@markaz/auth/browser', () => ({
  createSupabaseBrowserClient: () => ({ auth: { signInWithOtp, verifyOtp } }),
}));
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ replace, refresh }),
  usePathname: () => '/sign-in',
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

import { SignInFlow } from '@/components/sign-in-flow';

beforeEach(() => {
  signInWithOtp.mockReset().mockResolvedValue({ error: null });
  verifyOtp.mockReset().mockResolvedValue({ error: null });
  replace.mockReset();
});

describe('SignInFlow', () => {
  it('renders the email step (English)', () => {
    renderWithIntl(<SignInFlow />);
    expect(screen.getByText('Sign in or create your account')).toBeInTheDocument();
    expect(screen.getByLabelText(/Email address/i)).toBeInTheDocument();
  });

  it('validates an invalid email and does not call the provider', async () => {
    const user = userEvent.setup();
    renderWithIntl(<SignInFlow />);
    await user.type(screen.getByLabelText(/Email address/i), 'not-an-email');
    await user.click(screen.getByRole('button', { name: /Send code/i }));
    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument();
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it('sends an OTP and advances to the code step', async () => {
    const user = userEvent.setup();
    renderWithIntl(<SignInFlow />);
    await user.type(screen.getByLabelText(/Email address/i), 'customer-a@markaz.demo');
    await user.click(screen.getByRole('button', { name: /Send code/i }));
    await waitFor(() =>
      expect(signInWithOtp).toHaveBeenCalledWith({
        email: 'customer-a@markaz.demo',
        options: { shouldCreateUser: true },
      }),
    );
    expect(await screen.findByText('Enter your code')).toBeInTheDocument();
  });

  it('shows an invalid-code error from the provider', async () => {
    verifyOtp.mockResolvedValue({ error: { message: 'Token has expired or is invalid' } });
    const user = userEvent.setup();
    renderWithIntl(<SignInFlow />);
    await user.type(screen.getByLabelText(/Email address/i), 'customer-a@markaz.demo');
    await user.click(screen.getByRole('button', { name: /Send code/i }));
    await screen.findByText('Enter your code');
    await user.type(screen.getByLabelText(/6-digit code/i), '000000');
    await user.click(screen.getByRole('button', { name: /^Verify$/i }));
    expect(await screen.findByText(/has expired/i)).toBeInTheDocument();
  });

  it('renders Arabic copy with the OTP flow', () => {
    renderWithIntl(<SignInFlow />, 'ar');
    expect(screen.getByText('سجّل الدخول أو أنشئ حسابك')).toBeInTheDocument();
  });
});
