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

  it('rejects an unknown locale by falling back to the default', async () => {
    const res = await GET(req('?code=abc123&locale=fr'));
    expect(locationOf(res).pathname).toBe('/en/dashboard');
  });

  it('provider cancellation → recoverable sign-in screen (no exchange)', async () => {
    const res = await GET(req('?error=access_denied&locale=en'));
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    const url = locationOf(res);
    expect(url.pathname).toBe('/en/sign-in');
    expect(url.searchParams.get('error')).toBe('uae_pass_cancelled');
  });

  it('missing code → safe sign-in error', async () => {
    const res = await GET(req('?locale=en'));
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(locationOf(res).searchParams.get('error')).toBe('uae_pass');
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
});
