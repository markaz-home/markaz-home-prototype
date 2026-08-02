import { describe, it, expect, vi, beforeEach } from 'vitest';

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

describe('/auth/callback (UAE PASS sign-in)', () => {
  it('exchanges the code and forwards to the localized dashboard', async () => {
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

  it.each(['https%3A%2F%2Fevil.example', '%2Fonboarding%2Fprofile', '%2Fonboarding%2Fuae-pass'])(
    'rejects the unlisted destination %s',
    async (next) => {
      const res = await GET(req(`?code=abc123&locale=en&next=${next}`));
      expect(locationOf(res).pathname).toBe('/en/dashboard');
    },
  );

  it('falls back to English for an unknown locale', async () => {
    const res = await GET(req('?code=abc123&locale=fr'));
    expect(locationOf(res).pathname).toBe('/en/dashboard');
  });

  it('returns cancellation to sign-in without exchanging a code', async () => {
    const res = await GET(req('?error=access_denied&locale=en'));
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    const url = locationOf(res);
    expect(url.pathname).toBe('/en/sign-in');
    expect(url.searchParams.get('error')).toBe('uae_pass_cancelled');
  });

  it('maps provider failures to a generic sign-in error', async () => {
    const res = await GET(req('?error=server_error&error_code=provider_detail&locale=en'));
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(locationOf(res).searchParams.get('error')).toBe('uae_pass');
  });

  it('handles a missing code safely', async () => {
    const res = await GET(req('?locale=en'));
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(locationOf(res).searchParams.get('error')).toBe('uae_pass');
  });

  it('does not reflect a failed authorization code or provider detail', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: new Error('provider detail') });
    const res = await GET(req('?code=abc123&locale=en'));
    const url = locationOf(res);
    expect(url.pathname).toBe('/en/sign-in');
    expect(url.searchParams.get('error')).toBe('uae_pass');
    expect(url.search).not.toContain('abc123');
    expect(url.search).not.toContain('provider');
  });
});
