import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithIntl } from './test-utils';

const signInWithPassword = vi.fn();
const signInWithOAuth = vi.fn();
const replace = vi.fn();
const push = vi.fn();
const getSearchParams = vi.fn(() => new URLSearchParams());

vi.mock('@markaz/auth/browser', () => ({
  createSupabaseBrowserClient: () => ({ auth: { signInWithPassword, signInWithOAuth } }),
}));
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ replace, push, refresh: vi.fn() }),
  usePathname: () => '/sign-in',
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));
vi.mock('next/navigation', () => ({ useSearchParams: () => getSearchParams() }));

import { SignInForm } from '@/components/sign-in-form';

beforeEach(() => {
  signInWithPassword.mockReset().mockResolvedValue({ error: null });
  signInWithOAuth.mockReset().mockResolvedValue({ error: null });
  replace.mockReset();
  push.mockReset();
  getSearchParams.mockReset().mockReturnValue(new URLSearchParams());
});

describe('SignInForm', () => {
  it('renders "Welcome back" with email + password', () => {
    renderWithIntl(<SignInForm />);
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Password/)).toBeInTheDocument();
  });

  // --- UAE PASS staging (POC) — an optional sign-in method, server-gated --------
  it('does NOT show UAE PASS in simulated mode (default) — email/password unchanged', () => {
    renderWithIntl(<SignInForm />);
    expect(screen.queryByRole('button', { name: /UAE PASS/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('shows "Continue with UAE PASS Staging" only when staging mode is enabled', () => {
    renderWithIntl(<SignInForm uaePassStaging locale="en" />);
    expect(
      screen.getByRole('button', { name: /Continue with UAE PASS Staging/i }),
    ).toBeInTheDocument();
    // Still a test-environment disclaimer + email/password kept.
    expect(screen.getByText(/Test environment/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('the UAE PASS button starts the Supabase custom-provider OAuth flow', async () => {
    const user = userEvent.setup();
    renderWithIntl(<SignInForm uaePassStaging locale="ar" />);
    await user.click(screen.getByRole('button', { name: /Continue with UAE PASS Staging/i }));
    await waitFor(() => expect(signInWithOAuth).toHaveBeenCalledTimes(1));
    const arg = signInWithOAuth.mock.calls[0]![0];
    expect(arg.provider).toBe('custom:uae-pass');
    expect(arg.options.redirectTo).toContain('/auth/callback');
    expect(arg.options.redirectTo).toContain('locale=ar');
    // Password sign-in must not have been triggered.
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it('preserves an allow-listed destination through UAE PASS', async () => {
    getSearchParams.mockReturnValue(new URLSearchParams('next=%2Fsell'));
    const user = userEvent.setup();
    renderWithIntl(<SignInForm uaePassStaging locale="en" />);
    await user.click(screen.getByRole('button', { name: /Continue with UAE PASS Staging/i }));
    const arg = signInWithOAuth.mock.calls[0]![0];
    expect(arg.options.redirectTo).toContain('next=%2Fsell');
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
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(expect.stringContaining('/verify-email')),
    );
  });

  it('signs in successfully and routes to the dashboard', async () => {
    const user = userEvent.setup();
    renderWithIntl(<SignInForm />);
    await user.type(screen.getByLabelText(/Email address/i), 'customer-a@markaz.demo');
    await user.type(screen.getByLabelText(/^Password/), 'Aa1!aaaa');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/dashboard'));
  });

  it('honours the allow-listed post-sign-in destination', async () => {
    getSearchParams.mockReturnValue(new URLSearchParams('next=%2Fsell'));
    const user = userEvent.setup();
    renderWithIntl(<SignInForm />);
    await user.type(screen.getByLabelText(/Email address/i), 'customer-a@markaz.demo');
    await user.type(screen.getByLabelText(/^Password/), 'Aa1!aaaa');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/sell'));
  });

  it('rejects an external post-sign-in destination', async () => {
    getSearchParams.mockReturnValue(new URLSearchParams('next=https%3A%2F%2Fevil.example'));
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
