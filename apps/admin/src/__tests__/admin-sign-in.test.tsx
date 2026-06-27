import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithIntl } from './test-utils';

const signInWithOtp = vi.fn();
const verifyOtp = vi.fn();
const replace = vi.fn();

vi.mock('@markaz/auth/browser', () => ({
  createSupabaseBrowserClient: () => ({ auth: { signInWithOtp, verifyOtp } }),
}));
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ replace, refresh: vi.fn() }),
  usePathname: () => '/login',
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

import { AdminSignInFlow } from '@/components/admin-sign-in-flow';

beforeEach(() => {
  signInWithOtp.mockReset().mockResolvedValue({ error: null });
});

describe('AdminSignInFlow', () => {
  it('renders the isolated admin login (English)', () => {
    renderWithIntl(<AdminSignInFlow />);
    expect(screen.getByText('Admin sign in')).toBeInTheDocument();
    expect(screen.getByText('MARKAZ Admin')).toBeInTheDocument();
  });

  it('does not auto-create users on admin sign-in (shouldCreateUser:false)', async () => {
    const user = userEvent.setup();
    renderWithIntl(<AdminSignInFlow />);
    await user.type(screen.getByLabelText(/Email address/i), 'admin@markaz.demo');
    await user.click(screen.getByRole('button', { name: /Send code/i }));
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: 'admin@markaz.demo',
      options: { shouldCreateUser: false },
    });
  });

  it('renders Arabic admin login', () => {
    renderWithIntl(<AdminSignInFlow />, 'ar');
    expect(screen.getByText('تسجيل دخول الإدارة')).toBeInTheDocument();
  });
});
