import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithIntl } from './test-utils';

const signInWithPassword = vi.fn();
const replace = vi.fn();

vi.mock('@markaz/auth/browser', () => ({
  createSupabaseBrowserClient: () => ({ auth: { signInWithPassword } }),
}));
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ replace, refresh: vi.fn() }),
  usePathname: () => '/login',
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }));

import { AdminSignInFlow } from '@/components/admin-sign-in-flow';

beforeEach(() => {
  signInWithPassword.mockReset().mockResolvedValue({ error: null });
  replace.mockReset();
});

describe('AdminSignInFlow (Operations)', () => {
  it('renders the Operations sign-in with no Create account', () => {
    renderWithIntl(<AdminSignInFlow />);
    expect(screen.getByRole('heading', { name: 'Sign in to Operations' })).toBeInTheDocument();
    // "MARKAZ Operations" branding now lives in the persistent (auth) layout.
    expect(screen.getByText('Authorised access only')).toBeInTheDocument();
    expect(screen.getByLabelText(/^Password/)).toBeInTheDocument();
    expect(screen.queryByText('Create account')).not.toBeInTheDocument();
  });

  it('signs in with password and routes to overview', async () => {
    const user = userEvent.setup();
    renderWithIntl(<AdminSignInFlow />);
    await user.type(screen.getByLabelText(/Email address/i), 'admin@markaz.demo');
    await user.type(screen.getByLabelText(/^Password/), 'Markaz!Admin1');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() =>
      expect(signInWithPassword).toHaveBeenCalledWith({
        email: 'admin@markaz.demo',
        password: 'Markaz!Admin1',
      }),
    );
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/overview'));
  });

  it('shows a generic error for bad credentials', async () => {
    signInWithPassword.mockResolvedValue({ error: { message: 'Invalid login credentials' } });
    const user = userEvent.setup();
    renderWithIntl(<AdminSignInFlow />);
    await user.type(screen.getByLabelText(/Email address/i), 'admin@markaz.demo');
    await user.type(screen.getByLabelText(/^Password/), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('The email or password is incorrect.')).toBeInTheDocument();
  });

  it('renders Arabic admin login', () => {
    renderWithIntl(<AdminSignInFlow />, 'ar');
    expect(screen.getByRole('heading', { name: 'تسجيل الدخول إلى بوابة العمليات' })).toBeInTheDocument();
  });
});
