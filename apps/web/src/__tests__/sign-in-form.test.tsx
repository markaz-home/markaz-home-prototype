import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithIntl } from './test-utils';

const signInWithPassword = vi.fn();
const replace = vi.fn();
const push = vi.fn();

vi.mock('@markaz/auth/browser', () => ({
  createSupabaseBrowserClient: () => ({ auth: { signInWithPassword } }),
}));
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ replace, push, refresh: vi.fn() }),
  usePathname: () => '/sign-in',
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }));

import { SignInForm } from '@/components/sign-in-form';

beforeEach(() => {
  signInWithPassword.mockReset().mockResolvedValue({ error: null });
  replace.mockReset();
  push.mockReset();
});

describe('SignInForm', () => {
  it('renders "Welcome back" with email + password', () => {
    renderWithIntl(<SignInForm />);
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Password/)).toBeInTheDocument();
  });

  it('validates an invalid email without calling the provider', async () => {
    const user = userEvent.setup();
    renderWithIntl(<SignInForm />);
    await user.type(screen.getByLabelText(/Email address/i), 'bad');
    await user.type(screen.getByLabelText(/^Password/), 'whatever');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument();
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it('shows a generic error for incorrect credentials', async () => {
    signInWithPassword.mockResolvedValue({ error: { message: 'Invalid login credentials' } });
    const user = userEvent.setup();
    renderWithIntl(<SignInForm />);
    await user.type(screen.getByLabelText(/Email address/i), 'customer-a@markaz.demo');
    await user.type(screen.getByLabelText(/^Password/), 'Wrongpass1!');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('The email or password is incorrect.')).toBeInTheDocument();
  });

  it('routes an unverified email to verification', async () => {
    signInWithPassword.mockResolvedValue({ error: { message: 'Email not confirmed' } });
    const user = userEvent.setup();
    renderWithIntl(<SignInForm />);
    await user.type(screen.getByLabelText(/Email address/i), 'new@markaz.demo');
    await user.type(screen.getByLabelText(/^Password/), 'Aa1!aaaa');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(push).toHaveBeenCalledWith(expect.stringContaining('/verify-email')));
  });

  it('signs in successfully and routes to the dashboard', async () => {
    const user = userEvent.setup();
    renderWithIntl(<SignInForm />);
    await user.type(screen.getByLabelText(/Email address/i), 'customer-a@markaz.demo');
    await user.type(screen.getByLabelText(/^Password/), 'Aa1!aaaa');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/dashboard'));
  });

  it('renders Arabic', () => {
    renderWithIntl(<SignInForm />, 'ar');
    expect(screen.getByRole('heading', { name: 'مرحبًا بعودتك' })).toBeInTheDocument();
  });
});
