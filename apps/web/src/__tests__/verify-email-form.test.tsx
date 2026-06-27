import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithIntl } from './test-utils';

const verifyOtp = vi.fn();
const resend = vi.fn();
const replace = vi.fn();
const mutateAsync = vi.fn().mockResolvedValue({});

vi.mock('@markaz/auth/browser', () => ({
  createSupabaseBrowserClient: () => ({ auth: { verifyOtp, resend } }),
}));
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ replace, refresh: vi.fn() }),
  usePathname: () => '/verify-email',
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('email=customer-a%40markaz.demo'),
}));
vi.mock('@/trpc/react', () => ({
  trpc: { audit: { record: { useMutation: () => ({ mutateAsync }) } } },
}));

import { VerifyEmailForm } from '@/components/verify-email-form';

beforeEach(() => {
  verifyOtp.mockReset().mockResolvedValue({ error: null });
  resend.mockReset().mockResolvedValue({ error: null });
  replace.mockReset();
});

describe('VerifyEmailForm', () => {
  it('renders the verification screen with a code input', () => {
    renderWithIntl(<VerifyEmailForm />);
    expect(screen.getByRole('heading', { name: 'Verify your email' })).toBeInTheDocument();
    expect(screen.getByLabelText('Verification code')).toBeInTheDocument();
  });

  it('rejects a non-6-digit code client-side', async () => {
    const user = userEvent.setup();
    renderWithIntl(<VerifyEmailForm />);
    await user.type(screen.getByLabelText('Verification code'), '123');
    await user.click(screen.getByRole('button', { name: 'Verify email' }));
    expect(await screen.findByText('Enter all six digits.')).toBeInTheDocument();
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it('verifies a valid code and routes to the success screen', async () => {
    const user = userEvent.setup();
    renderWithIntl(<VerifyEmailForm />);
    await user.type(screen.getByLabelText('Verification code'), '123456');
    await user.click(screen.getByRole('button', { name: 'Verify email' }));
    await waitFor(() =>
      expect(verifyOtp).toHaveBeenCalledWith({
        email: 'customer-a@markaz.demo',
        token: '123456',
        type: 'signup',
      }),
    );
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/verify-email/success'));
  });

  it('shows an expired-code error from the provider', async () => {
    verifyOtp.mockResolvedValue({ error: { message: 'Token has expired' } });
    const user = userEvent.setup();
    renderWithIntl(<VerifyEmailForm />);
    await user.type(screen.getByLabelText('Verification code'), '654321');
    await user.click(screen.getByRole('button', { name: 'Verify email' }));
    expect(
      await screen.findByText('This code has expired. Request a new code to continue.'),
    ).toBeInTheDocument();
  });
});
