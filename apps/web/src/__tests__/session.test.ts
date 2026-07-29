import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as ReactModule from 'react';

const { getUser, loadOwnProfileRow, redirect } = vi.hoisted(() => ({
  getUser: vi.fn(),
  loadOwnProfileRow: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof ReactModule>();
  return { ...actual, cache: <T extends (...args: never[]) => unknown>(fn: T) => fn };
});
vi.mock('next/navigation', () => ({ redirect }));
vi.mock('@markaz/auth/server', () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser } }),
  getAuthProviderIds: () => [],
}));
vi.mock('@markaz/db', () => ({ loadOwnProfileRow }));

import { getSession, requireCustomerStep } from '@/server/session';

beforeEach(() => {
  getUser.mockReset().mockResolvedValue({
    data: {
      user: {
        id: 'user-1',
        email: 'person@example.com',
        email_confirmed_at: '2026-07-19T00:00:00.000Z',
      },
    },
  });
  loadOwnProfileRow.mockReset();
  redirect.mockReset();
});

describe('requireCustomerStep account boundary', () => {
  it('sends an admin session to a neutral denial route in the customer app', async () => {
    const now = new Date('2026-07-27T00:00:00.000Z');
    loadOwnProfileRow.mockResolvedValue({
      id: 'user-1',
      email: 'person@example.com',
      fullName: 'Operations User',
      accountType: 'ADMIN',
      identityVerificationStatus: 'VERIFIED_DEMO',
      termsAcceptedAt: now,
      privacyAcceptedAt: now,
      onboardingCompletedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    await requireCustomerStep('en', ['dashboard']);

    expect(redirect).toHaveBeenCalledWith('/en/access-denied');
    expect(redirect).not.toHaveBeenCalledWith(expect.stringContaining('operations'));
  });
});

describe('getSession profile loading', () => {
  it('keeps a genuine missing profile as the onboarding fallback', async () => {
    loadOwnProfileRow.mockResolvedValue(null);
    await expect(getSession()).resolves.toMatchObject({ profile: null, userId: 'user-1' });
  });

  it('propagates operational database failures', async () => {
    loadOwnProfileRow.mockRejectedValue(new Error('database unavailable'));
    await expect(getSession()).rejects.toThrow('database unavailable');
  });
});
