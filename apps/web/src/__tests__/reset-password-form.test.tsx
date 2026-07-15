import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithIntl } from './test-utils';

const updateUser = vi.fn();
const signOut = vi.fn();
const replace = vi.fn();
const mutateAsync = vi.fn().mockResolvedValue({});

vi.mock('@markaz/auth/browser', () => ({
  createSupabaseBrowserClient: () => ({ auth: { updateUser, signOut } }),
}));
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/reset-password',
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));
vi.mock('@/trpc/react', () => ({
  trpc: { audit: { record: { useMutation: () => ({ mutateAsync }) } } },
}));

import { ResetPasswordForm } from '@/components/reset-password-form';

beforeEach(() => {
  updateUser.mockReset().mockResolvedValue({ error: null });
  signOut.mockReset().mockResolvedValue({ error: null });
  replace.mockReset();
});

describe('ResetPasswordForm (recovery session — no code field)', () => {
  it('renders new-password fields and NO six-digit recovery code field', () => {
    renderWithIntl(<ResetPasswordForm />);
    expect(screen.getByRole('heading', { name: 'Choose a new password' })).toBeInTheDocument();
    expect(screen.getByLabelText(/^New password/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Confirm new password/)).toBeInTheDocument();
    // Critical: recovery is link-based; there must be no code-entry field here.
    expect(screen.queryByLabelText(/Verification code/i)).toBeNull();
    expect(screen.queryByLabelText(/recovery code/i)).toBeNull();
  });

  it('updates the password then signs out and routes to the success screen', async () => {
    const user = userEvent.setup();
    renderWithIntl(<ResetPasswordForm />);
    await user.type(screen.getByLabelText(/^New password/), 'NewMarkaz!2');
    await user.type(screen.getByLabelText(/^Confirm new password/), 'NewMarkaz!2');
    await user.click(screen.getByRole('button', { name: 'Update password' }));

    await waitFor(() => expect(updateUser).toHaveBeenCalledWith({ password: 'NewMarkaz!2' }));
    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
    expect(replace).toHaveBeenCalledWith('/reset-password/success');
  });

  it('rejects a password longer than 128 characters (no silent truncation, no updateUser)', async () => {
    renderWithIntl(<ResetPasswordForm />);
    const tooLong = `Aa1!${'a'.repeat(125)}`; // 129 chars
    expect(tooLong.length).toBe(129);
    fireEvent.change(screen.getByLabelText(/^New password/), { target: { value: tooLong } });
    fireEvent.change(screen.getByLabelText(/^Confirm new password/), {
      target: { value: tooLong },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Update password' }));
    expect(
      await screen.findByText('Password must be 128 characters or fewer.'),
    ).toBeInTheDocument();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('renders Arabic recovery copy', () => {
    renderWithIntl(<ResetPasswordForm />, 'ar');
    expect(screen.getByRole('heading', { name: 'اختر كلمة مرور جديدة' })).toBeInTheDocument();
    expect(screen.queryByLabelText(/رمز التحقق/i)).toBeNull();
  });
});
