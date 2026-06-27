import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithIntl } from './test-utils';

const signUp = vi.fn();
const push = vi.fn();

vi.mock('@markaz/auth/browser', () => ({
  createSupabaseBrowserClient: () => ({ auth: { signUp } }),
}));
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/sign-up',
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

import { SignUpForm } from '@/components/sign-up-form';

async function fillValid(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/Full name/i), 'Demo Customer');
  await user.type(screen.getByLabelText(/Email address/i), 'new@markaz.demo');
  await user.type(screen.getByLabelText(/^Password/), 'Aa1!aaaa');
  await user.type(screen.getByLabelText(/^Confirm password/), 'Aa1!aaaa');
  await user.click(screen.getByLabelText(/Terms of Use/i));
  await user.click(screen.getByLabelText(/Privacy Policy/i));
}

beforeEach(() => {
  signUp.mockReset().mockResolvedValue({ data: { user: { identities: [{ id: 'x' }] } }, error: null });
  push.mockReset();
});

describe('SignUpForm', () => {
  it('renders the spec title + live password checklist', () => {
    renderWithIntl(<SignUpForm />);
    expect(screen.getByRole('heading', { name: 'Create your MARKAZ account' })).toBeInTheDocument();
    expect(screen.getByText('At least 8 characters')).toBeInTheDocument();
    expect(screen.getByText('One special character')).toBeInTheDocument();
  });

  it('does not submit a policy-failing password', async () => {
    const user = userEvent.setup();
    renderWithIntl(<SignUpForm />);
    await user.type(screen.getByLabelText(/Full name/i), 'Demo Customer');
    await user.type(screen.getByLabelText(/Email address/i), 'new@markaz.demo');
    await user.type(screen.getByLabelText(/^Password/), 'nouppercase9!');
    await user.type(screen.getByLabelText(/^Confirm password/), 'nouppercase9!');
    await user.click(screen.getByLabelText(/Terms of Use/i));
    await user.click(screen.getByLabelText(/Privacy Policy/i));
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    await waitFor(() => expect(signUp).not.toHaveBeenCalled());
  });

  it('rejects a password mismatch', async () => {
    const user = userEvent.setup();
    renderWithIntl(<SignUpForm />);
    await user.type(screen.getByLabelText(/Full name/i), 'Demo Customer');
    await user.type(screen.getByLabelText(/Email address/i), 'new@markaz.demo');
    await user.type(screen.getByLabelText(/^Password/), 'Aa1!aaaa');
    await user.type(screen.getByLabelText(/^Confirm password/), 'Aa1!bbbb');
    await user.click(screen.getByLabelText(/Terms of Use/i));
    await user.click(screen.getByLabelText(/Privacy Policy/i));
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('Passwords do not match.')).toBeInTheDocument();
  });

  it('creates an account and routes to Check Your Email', async () => {
    const user = userEvent.setup();
    renderWithIntl(<SignUpForm />);
    await fillValid(user);
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    await waitFor(() => expect(signUp).toHaveBeenCalledTimes(1));
    expect(push).toHaveBeenCalledWith(expect.stringContaining('/sign-up/check-email'));
  });

  it('handles an existing email safely (no duplicate)', async () => {
    signUp.mockResolvedValue({ data: { user: { identities: [] } }, error: null });
    const user = userEvent.setup();
    renderWithIntl(<SignUpForm />);
    await fillValid(user);
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText(/We could not create a new account/)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it('renders Arabic', () => {
    renderWithIntl(<SignUpForm />, 'ar');
    expect(screen.getByRole('heading', { name: 'أنشئ حسابك في MARKAZ' })).toBeInTheDocument();
  });
});
