import { describe, it, expect, vi, beforeEach } from 'vitest';

const exchangeCodeForSession = vi.fn();
const rpc = vi.fn();
const getUser = vi.fn();
const signOut = vi.fn();
vi.mock('@markaz/auth/server', () => ({
  createSupabaseServerClient: async () => ({
    auth: { exchangeCodeForSession, getUser, signOut },
    rpc,
  }),
  getAuthProviderIds: (user: { app_metadata?: { providers?: string[] } }) =>
    user.app_metadata?.providers ?? [],
}));
const loadOwnProfileRow = vi.fn();
vi.mock('@markaz/db', () => ({
  loadOwnProfileRow: (...args: unknown[]) => loadOwnProfileRow(...args),
}));

import { GET } from '@/app/auth/callback/route';

function req(qs: string) {
  return new Request(`http://localhost:3000/auth/callback${qs}`) as never;
}
const locationOf = (res: Response) => new URL(res.headers.get('location') ?? '', 'http://x');

beforeEach(() => {
  exchangeCodeForSession.mockReset().mockResolvedValue({ error: null });
  rpc.mockReset().mockResolvedValue({ error: null });
  getUser.mockReset().mockResolvedValue({
    data: {
      user: {
        id: 'user-1',
        email: 'c@x.ae',
        app_metadata: { providers: ['custom:uae-pass'] },
        identities: [{ provider: 'custom:uae-pass' }],
      },
    },
  });
  signOut.mockReset().mockResolvedValue({ error: null });
  loadOwnProfileRow.mockReset().mockResolvedValue(null);
});

describe('/auth/callback (UAE PASS sign-in)', () => {
  it('exchanges the code and forwards to the localized dashboard', async () => {
    const res = await GET(req('?code=abc123&locale=en&provider=uae-pass'));
    expect(exchangeCodeForSession).toHaveBeenCalledWith('abc123');
    expect(locationOf(res).pathname).toBe('/en/dashboard');
  });

  it('preserves the Arabic locale', async () => {
    const res = await GET(req('?code=abc123&locale=ar&provider=uae-pass'));
    expect(locationOf(res).pathname).toBe('/ar/dashboard');
  });

  it('forwards to an allow-listed post-sign-in destination', async () => {
    const res = await GET(req('?code=abc123&locale=en&provider=uae-pass&next=%2Fsell'));
    expect(locationOf(res).pathname).toBe('/en/sell');
  });

  it.each(['https%3A%2F%2Fevil.example', '%2Fonboarding%2Fprofile', '%2Fonboarding%2Fuae-pass'])(
    'rejects the unlisted destination %s',
    async (next) => {
      const res = await GET(req(`?code=abc123&locale=en&provider=uae-pass&next=${next}`));
      expect(locationOf(res).pathname).toBe('/en/dashboard');
    },
  );

  it('falls back to English for an unknown locale', async () => {
    const res = await GET(req('?code=abc123&locale=fr&provider=uae-pass'));
    expect(locationOf(res).pathname).toBe('/en/dashboard');
  });

  it('returns cancellation to sign-in without exchanging a code', async () => {
    const res = await GET(req('?error=access_denied&locale=en&provider=uae-pass'));
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    const url = locationOf(res);
    expect(url.pathname).toBe('/en/sign-in');
    expect(url.searchParams.get('error')).toBe('provider_cancelled');
  });

  it('maps provider failures to a generic sign-in error', async () => {
    const res = await GET(req('?error=server_error&error_code=provider_detail&locale=en'));
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(locationOf(res).searchParams.get('error')).toBe('provider_error');
  });

  it('treats the retired login-only hook marker as a generic provider failure', async () => {
    const res = await GET(
      req('?error=access_denied&error_description=MARKAZ_UAE_PASS_NOT_LINKED&locale=en'),
    );
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    const url = locationOf(res);
    expect(url.pathname).toBe('/en/sign-in');
    expect(url.searchParams.get('error')).toBe('provider_error');
    expect(url.searchParams.get('next')).toBeNull();
  });

  it('handles a missing code safely', async () => {
    const res = await GET(req('?locale=en'));
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(locationOf(res).searchParams.get('error')).toBe('provider_error');
  });

  it('does not reflect a failed authorization code or provider detail', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: new Error('provider detail') });
    const res = await GET(req('?code=abc123&locale=en&provider=uae-pass'));
    const url = locationOf(res);
    expect(url.pathname).toBe('/en/sign-in');
    expect(url.searchParams.get('error')).toBe('provider_error');
    expect(url.search).not.toContain('abc123');
    expect(url.search).not.toContain('detail');
  });

  it('completes an authenticated identity link and returns to Profile', async () => {
    const res = await GET(req('?code=abc123&locale=en&flow=link'));
    expect(exchangeCodeForSession).toHaveBeenCalledWith('abc123');
    expect(rpc).not.toHaveBeenCalled();
    const url = locationOf(res);
    expect(url.pathname).toBe('/en/account/profile');
    expect(url.searchParams.get('uae_pass')).toBe('uae_pass_linked');
  });

  it('synchronizes provider-owned UAE PASS profile fields after first-time authentication', async () => {
    const res = await GET(req('?code=abc123&locale=en&provider=uae-pass&intent=sign-up'));
    expect(exchangeCodeForSession).toHaveBeenCalledWith('abc123');
    expect(rpc).toHaveBeenCalledWith('sync_uae_pass_staging_identity');
    expect(locationOf(res).pathname).toBe('/en/dashboard');
  });

  it('rejects a non-UAE-PASS provider before exchanging its code', async () => {
    const res = await GET(req('?code=abc123&locale=en&provider=unsupported&intent=sign-up'));
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
    expect(locationOf(res).searchParams.get('error')).toBe('provider_error');
  });

  it('signs out if the exchanged session does not contain a UAE PASS identity', async () => {
    getUser.mockResolvedValue({
      data: { user: { id: 'user-1', app_metadata: { providers: ['unsupported'] } } },
    });
    const res = await GET(req('?code=abc123&locale=en&provider=uae-pass'));
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(locationOf(res).searchParams.get('error')).toBe('provider_error');
  });

  it('returns a cancelled identity link to Profile without changing the account', async () => {
    const res = await GET(req('?error=access_denied&locale=en&flow=link'));
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    const url = locationOf(res);
    expect(url.pathname).toBe('/en/account/profile');
    expect(url.searchParams.get('uae_pass')).toBe('uae_pass_cancelled');
  });

  it('maps an identity already owned by another user to a safe Profile notice', async () => {
    const res = await GET(
      req('?error=server_error&error_code=identity_already_exists&locale=en&flow=link'),
    );
    const url = locationOf(res);
    expect(url.pathname).toBe('/en/account/profile');
    expect(url.searchParams.get('uae_pass')).toBe('uae_pass_identity_unavailable');
  });

  it('does not let profile recording delay or override a completed Auth link', async () => {
    rpc.mockResolvedValue({ error: new Error('database unavailable') });
    const res = await GET(req('?code=abc123&locale=en&flow=link'));
    expect(rpc).not.toHaveBeenCalled();
    const url = locationOf(res);
    expect(url.pathname).toBe('/en/account/profile');
    expect(url.searchParams.get('uae_pass')).toBe('uae_pass_linked');
  });
});

describe('/auth/callback (sign-up intent, ADR-0033 refinement 2026-08-07)', () => {
  const completeProfile = {
    fullName: 'Existing Customer',
    termsAcceptedAt: new Date('2026-08-01T00:00:00Z'),
    privacyAcceptedAt: new Date('2026-08-01T00:00:00Z'),
  };

  it('signs out an established customer and returns to sign-in with a notice', async () => {
    loadOwnProfileRow.mockResolvedValue(completeProfile);
    const res = await GET(req('?code=abc123&locale=en&intent=sign-up&provider=uae-pass'));
    expect(signOut).toHaveBeenCalledTimes(1);
    const url = locationOf(res);
    expect(url.pathname).toBe('/en/sign-in');
    expect(url.searchParams.get('error')).toBe('already_registered');
    // The bounce happens before provider profile synchronization.
    expect(rpc).not.toHaveBeenCalled();
  });

  it('lets a new provider identity continue to onboarding', async () => {
    loadOwnProfileRow.mockResolvedValue(null);
    const res = await GET(req('?code=abc123&locale=en&intent=sign-up&provider=uae-pass'));
    expect(signOut).not.toHaveBeenCalled();
    expect(locationOf(res).pathname).toBe('/en/dashboard');
  });

  it('lets an incomplete account (abandoned first attempt) resume onboarding', async () => {
    loadOwnProfileRow.mockResolvedValue({
      fullName: 'Existing Customer',
      termsAcceptedAt: null,
      privacyAcceptedAt: null,
    });
    const res = await GET(req('?code=abc123&locale=en&intent=sign-up&provider=uae-pass'));
    expect(signOut).not.toHaveBeenCalled();
    expect(locationOf(res).pathname).toBe('/en/dashboard');
  });

  it('never bounces a sign-in intent, even for an established customer', async () => {
    loadOwnProfileRow.mockResolvedValue(completeProfile);
    const res = await GET(req('?code=abc123&locale=en&intent=sign-in&provider=uae-pass'));
    expect(signOut).not.toHaveBeenCalled();
    expect(locationOf(res).pathname).toBe('/en/dashboard');
  });
});
