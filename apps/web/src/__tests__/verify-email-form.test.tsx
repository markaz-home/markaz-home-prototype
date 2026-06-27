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
  it('renders the verification screen', () => {
    renderWithIntl(<VerifyEmailForm />);
    expect(screen.getByRole('heading', { name: 'Verify your email' })).toBeInTheDocument();
    expect(screen.getByLabelText(/6-digit code/i)).toBeInTheDocument();
  });

  it('rejects a non-6-digit code client-side', async () => {
    const user = userEvent.setup();
    renderWithIntl(<VerifyEmailForm />);
    await user.type(screen.getByLabelText(/6-digit code/i), '123');
    await user.click(screen.getByRole('button', { name: 'Verify email' }));
    expect(await screen.findByText("That code isn't right. Check it and try again.")).toBeInTheDocument();
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it('verifies a valid code and routes onward', async () => {
    const user = userEvent.setup();
    renderWithIntl(<VerifyEmailForm />);
    await user.type(screen.getByLabelText(/6-digit code/i), '123456');
    await user.click(screen.getByRole('button', { name: 'Verify email' }));
    await waitFor(() =>
      expect(verifyOtp).toHaveBeenCalledWith({
        email: 'customer-a@markaz.demo',
        token: '123456',
        type: 'signup',
      }),
    );
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/dashboard'));
  });

  it('shows an expired-code error from the provider', async () => {
    verifyOtp.mockResolvedValue({ error: { message: 'Token has expired' } });
    const user = userEvent.setup();
    renderWithIntl(<VerifyEmailForm />);
    await user.type(screen.getByLabelText(/6-digit code/i), '654321');
    await user.click(screen.getByRole('button', { name: 'Verify email' }));
    expect(await screen.findByText('That code has expired. Request a new one.')).toBeInTheDocument();
  });
});
