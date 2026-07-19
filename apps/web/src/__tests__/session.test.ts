import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as ReactModule from 'react';

const { getUser, loadOwnProfileRow } = vi.hoisted(() => ({
  getUser: vi.fn(),
  loadOwnProfileRow: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof ReactModule>();
  return { ...actual, cache: <T extends (...args: never[]) => unknown>(fn: T) => fn };
});
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('@markaz/auth/server', () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser } }),
  getAuthProviderIds: () => [],
}));
vi.mock('@markaz/db', () => ({ loadOwnProfileRow }));

import { getSession } from '@/server/session';

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
