import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithIntl } from './test-utils';

const resetPasswordForEmail = vi.fn();
const push = vi.fn();

vi.mock('@markaz/auth/browser', () => ({
  createSupabaseBrowserClient: () => ({ auth: { resetPasswordForEmail } }),
}));
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/forgot-password',
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

import { ForgotPasswordForm } from '@/components/forgot-password-form';

beforeEach(() => {
  resetPasswordForEmail.mockReset().mockResolvedValue({ data: {}, error: null });
  push.mockReset();
});

describe('ForgotPasswordForm (official recovery link)', () => {
  it('sends the official recovery email with a /auth/confirm redirect, then shows the generic confirmation', async () => {
    const user = userEvent.setup();
    renderWithIntl(<ForgotPasswordForm />);
    await user.type(screen.getByLabelText(/Email address/i), 'customer-b@markaz.demo');
    await user.click(screen.getByRole('button', { name: /Send recovery email/i }));

    await waitFor(() => expect(resetPasswordForEmail).toHaveBeenCalledTimes(1));
    const [email, opts] = resetPasswordForEmail.mock.calls[0] as [string, { redirectTo: string }];
    expect(email).toBe('customer-b@markaz.demo');
    expect(opts.redirectTo).toMatch(/\/auth\/confirm\/en$/);
    // Anti-enumeration: always route to the generic "check your email" confirmation.
    expect(push).toHaveBeenCalledWith(expect.stringContaining('/forgot-password/check-email'));
  });

  it('still shows the generic confirmation even when the provider hides existence', async () => {
    // A non-rate/non-provider error must NOT be surfaced (no enumeration).
    resetPasswordForEmail.mockResolvedValue({ data: {}, error: { message: 'User not found' } });
    const user = userEvent.setup();
    renderWithIntl(<ForgotPasswordForm />);
    await user.type(screen.getByLabelText(/Email address/i), 'nobody@markaz.demo');
    await user.click(screen.getByRole('button', { name: /Send recovery email/i }));
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(expect.stringContaining('/forgot-password/check-email')),
    );
  });

  it('renders Arabic', () => {
    renderWithIntl(<ForgotPasswordForm />, 'ar');
    expect(screen.getByRole('heading', { name: 'إعادة تعيين كلمة المرور' })).toBeInTheDocument();
  });
});
