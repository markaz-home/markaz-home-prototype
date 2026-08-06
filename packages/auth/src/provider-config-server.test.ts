import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { isGoogleAuthEnabled } from './provider-config-server';

const originalEnvironment = {
  enabled: process.env.GOOGLE_AUTH_ENABLED,
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
};

afterEach(() => {
  vi.unstubAllGlobals();
  setOrDelete('GOOGLE_AUTH_ENABLED', originalEnvironment.enabled);
  setOrDelete('NEXT_PUBLIC_SUPABASE_URL', originalEnvironment.url);
  setOrDelete('NEXT_PUBLIC_SUPABASE_ANON_KEY', originalEnvironment.key);
});

function setOrDelete(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

describe('isGoogleAuthEnabled', () => {
  it('uses an explicit server override without contacting Supabase', async () => {
    process.env.GOOGLE_AUTH_ENABLED = 'true';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(isGoogleAuthEnabled()).resolves.toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('discovers an enabled provider from public Supabase Auth settings', async () => {
    delete process.env.GOOGLE_AUTH_ENABLED;
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co/';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'public-anon-key';
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ external: { google: true } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(isGoogleAuthEnabled()).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://project.supabase.co/auth/v1/settings',
      expect.objectContaining({ headers: { apikey: 'public-anon-key' } }),
    );
  });

  it('keeps email/password available when provider discovery fails', async () => {
    delete process.env.GOOGLE_AUTH_ENABLED;
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'public-anon-key';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    await expect(isGoogleAuthEnabled()).resolves.toBe(false);
  });
});
