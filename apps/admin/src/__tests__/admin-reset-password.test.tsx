import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithIntl } from './test-utils';

const updateUser = vi.fn();
const signOut = vi.fn();
const replace = vi.fn();

vi.mock('@markaz/auth/browser', () => ({
  createSupabaseBrowserClient: () => ({ auth: { updateUser, signOut } }),
}));
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/reset-password',
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

import { AdminResetPassword } from '@/components/admin-reset-password';

beforeEach(() => {
  updateUser.mockReset().mockResolvedValue({ error: null });
  signOut.mockReset().mockResolvedValue({ error: null });
  replace.mockReset();
});

describe('AdminResetPassword (recovery session — no code field)', () => {
  it('renders the admin reset form with NO recovery code field', () => {
    renderWithIntl(<AdminResetPassword />);
    expect(
      screen.getByRole('heading', { name: 'Choose a new Admin password' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/^New password/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Verification code/i)).toBeNull();
  });

  it('updates the password, signs out, and routes to the admin success screen', async () => {
    const user = userEvent.setup();
    renderWithIntl(<AdminResetPassword />);
    await user.type(screen.getByLabelText(/^New password/), 'NewAdmin!23');
    await user.type(screen.getByLabelText(/^Confirm new password/), 'NewAdmin!23');
    await user.click(screen.getByRole('button', { name: 'Update password' }));

    await waitFor(() => expect(updateUser).toHaveBeenCalledWith({ password: 'NewAdmin!23' }));
    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
    expect(replace).toHaveBeenCalledWith('/reset-password/success');
  });

  it('renders Arabic admin reset copy', () => {
    renderWithIntl(<AdminResetPassword />, 'ar');
    expect(
      screen.getByRole('heading', { name: 'اختر كلمة مرور جديدة للمشرف' }),
    ).toBeInTheDocument();
  });
});
