import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the SSR server client so no real Supabase/network is touched.
const exchangeCodeForSession = vi.fn();
vi.mock('@markaz/auth/server', () => ({
  createSupabaseServerClient: async () => ({ auth: { exchangeCodeForSession } }),
}));

import { GET } from '@/app/auth/callback/route';

function req(qs: string) {
  return new Request(`http://localhost:3000/auth/callback${qs}`) as never;
}
const locationOf = (res: Response) => new URL(res.headers.get('location') ?? '', 'http://x');

beforeEach(() => {
  exchangeCodeForSession.mockReset().mockResolvedValue({ error: null });
});

describe('/auth/callback (OAuth code exchange — UAE PASS staging)', () => {
  it('exchanges the code and forwards to the localized dashboard on success', async () => {
    const res = await GET(req('?code=abc123&locale=en'));
    expect(exchangeCodeForSession).toHaveBeenCalledWith('abc123');
    expect(locationOf(res).pathname).toBe('/en/dashboard');
  });

  it('preserves the Arabic locale', async () => {
    const res = await GET(req('?code=abc123&locale=ar'));
    expect(locationOf(res).pathname).toBe('/ar/dashboard');
  });

  it('forwards to an allow-listed post-sign-in destination', async () => {
    const res = await GET(req('?code=abc123&locale=en&next=%2Fsell'));
    expect(locationOf(res).pathname).toBe('/en/sell');
  });

  it('returns a successful identity link to the onboarding step', async () => {
    const res = await GET(req('?code=abc123&locale=en&next=%2Fonboarding%2Fuae-pass'));
    expect(locationOf(res).pathname).toBe('/en/onboarding/uae-pass');
  });

  it('rejects an external post-sign-in destination', async () => {
    const res = await GET(req('?code=abc123&locale=en&next=https%3A%2F%2Fevil.example'));
    expect(locationOf(res).pathname).toBe('/en/dashboard');
  });

  it('rejects an unlisted internal post-sign-in destination', async () => {
    const res = await GET(req('?code=abc123&locale=en&next=%2Fonboarding%2Fprofile'));
    expect(locationOf(res).pathname).toBe('/en/dashboard');
  });

  it('rejects an unknown locale by falling back to the default', async () => {
    const res = await GET(req('?code=abc123&locale=fr'));
    expect(locationOf(res).pathname).toBe('/en/dashboard');
  });

  it('user cancellation (access_denied) → recoverable "cancelled" message (no exchange)', async () => {
    const res = await GET(req('?error=access_denied&locale=en'));
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    const url = locationOf(res);
    expect(url.pathname).toBe('/en/sign-in');
    expect(url.searchParams.get('error')).toBe('uae_pass_cancelled');
  });

  it('a provider/server error (not cancellation) → generic failure, not "cancelled"', async () => {
    const res = await GET(req('?error=server_error&error_code=unexpected_failure&locale=en'));
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(locationOf(res).searchParams.get('error')).toBe('uae_pass');
  });

  it('returns identity-link cancellation to onboarding with a neutral safe notice', async () => {
    const res = await GET(req('?error=access_denied&locale=en&next=%2Fonboarding%2Fuae-pass'));
    const url = locationOf(res);
    expect(url.pathname).toBe('/en/onboarding/uae-pass');
    expect(url.searchParams.get('notice')).toBe('uae_pass_cancelled');
  });

  it('maps an already-owned identity to a distinct non-enumerating onboarding notice', async () => {
    const res = await GET(
      req(
        '?error=server_error&error_code=identity_already_exists&locale=en&next=%2Fonboarding%2Fuae-pass',
      ),
    );
    const url = locationOf(res);
    expect(url.pathname).toBe('/en/onboarding/uae-pass');
    expect(url.searchParams.get('notice')).toBe('uae_pass_identity_unavailable');
  });

  it('maps disabled manual linking to its safe configuration notice', async () => {
    const res = await GET(
      req(
        '?error=server_error&error_code=manual_linking_disabled&locale=en&next=%2Fonboarding%2Fuae-pass',
      ),
    );
    expect(locationOf(res).searchParams.get('notice')).toBe('uae_pass_configuration_error');
  });

  it('missing code → safe sign-in error', async () => {
    const res = await GET(req('?locale=en'));
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(locationOf(res).searchParams.get('error')).toBe('uae_pass');
  });

  it('missing code in a link flow returns a generic onboarding notice', async () => {
    const res = await GET(req('?locale=en&next=%2Fonboarding%2Fuae-pass'));
    const url = locationOf(res);
    expect(url.pathname).toBe('/en/onboarding/uae-pass');
    expect(url.searchParams.get('notice')).toBe('uae_pass_error');
  });

  it('exchange failure → safe sign-in error (never a token/code in the redirect)', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: new Error('boom') });
    const res = await GET(req('?code=abc123&locale=en'));
    const url = locationOf(res);
    expect(url.pathname).toBe('/en/sign-in');
    expect(url.searchParams.get('error')).toBe('uae_pass');
    // The authorization code must never be reflected back into any URL.
    expect(url.search).not.toContain('abc123');
  });

  it('exchange failure in a link flow remains recoverable on the identity step', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: new Error('provider detail') });
    const res = await GET(req('?code=abc123&locale=en&next=%2Fonboarding%2Fuae-pass'));
    const url = locationOf(res);
    expect(url.pathname).toBe('/en/onboarding/uae-pass');
    expect(url.searchParams.get('notice')).toBe('uae_pass_error');
    expect(url.search).not.toContain('abc123');
    expect(url.search).not.toContain('provider');
  });
});
