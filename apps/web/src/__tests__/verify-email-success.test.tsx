import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const { getSession, redirect } = vi.hoisted(() => ({
  getSession: vi.fn(),
  redirect: vi.fn(),
}));

const copy: Record<string, string> = {
  successTitle: 'Welcome to Markaz',
  successBody: 'Your email is verified and your account is ready.',
  profileSuccessBody: 'Your email is verified. Complete the remaining profile detail to continue.',
  continueDashboard: 'Continue to dashboard',
  completeProfile: 'Complete profile',
};

vi.mock('next-intl/server', () => ({
  setRequestLocale: vi.fn(),
  getTranslations: async () => (key: string) => copy[key] ?? key,
}));
vi.mock('next/navigation', () => ({ redirect }));
vi.mock('@/server/session', () => ({ getSession }));
vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

import VerificationSuccessPage from '@/app/[locale]/(auth)/verify-email/success/page';

const completeProfile = {
  fullName: 'New Customer',
  termsAcceptedAt: '2026-08-02T00:00:00.000Z',
  privacyAcceptedAt: '2026-08-02T00:00:00.000Z',
  identityVerificationStatus: 'NOT_STARTED' as const,
};

describe('email verification success', () => {
  it('welcomes a completed signup and continues directly to dashboard', async () => {
    getSession.mockResolvedValue({
      email: 'new@example.com',
      emailVerified: true,
      uaePassAuthenticated: false,
      profile: completeProfile,
    });

    render(
      await VerificationSuccessPage({
        params: Promise.resolve({ locale: 'en' }),
      }),
    );

    expect(screen.getByRole('heading', { name: 'Welcome to Markaz' })).toBeInTheDocument();
    expect(
      screen.getByText('Your email is verified and your account is ready.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Continue to dashboard' })).toHaveAttribute(
      'href',
      '/dashboard',
    );
    expect(screen.queryByText(/identity verification/i)).not.toBeInTheDocument();
  });

  it('keeps profile setup as the only fallback', async () => {
    getSession.mockResolvedValue({
      email: 'new@example.com',
      emailVerified: true,
      uaePassAuthenticated: false,
      profile: null,
    });

    render(
      await VerificationSuccessPage({
        params: Promise.resolve({ locale: 'en' }),
      }),
    );

    expect(screen.getByRole('link', { name: 'Complete profile' })).toHaveAttribute(
      'href',
      '/onboarding/profile',
    );
  });
});
