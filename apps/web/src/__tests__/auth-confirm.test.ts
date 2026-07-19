import { beforeEach, describe, expect, it, vi } from 'vitest';

const verifyOtp = vi.fn();
vi.mock('@markaz/auth/server', () => ({
  createSupabaseServerClient: async () => ({ auth: { verifyOtp } }),
}));

import { GET } from '@/app/auth/confirm/route';
import { handleRecoveryConfirmation } from '@/app/auth/confirm/handler';

function req(query: string) {
  return new Request(`http://localhost:3000/auth/confirm${query}`) as never;
}

function locationOf(response: Response) {
  return new URL(response.headers.get('location') ?? '', 'http://localhost:3000');
}

beforeEach(() => {
  verifyOtp.mockReset().mockResolvedValue({ error: null });
});

describe('/auth/confirm recovery callback', () => {
  it('uses a validated route locale and a fixed recovery destination', async () => {
    const response = await handleRecoveryConfirmation(
      req('?token_hash=secret&type=recovery&next=https%3A%2F%2Fevil.example'),
      'ar',
    );
    expect(verifyOtp).toHaveBeenCalledWith({ type: 'recovery', token_hash: 'secret' });
    expect(locationOf(response).pathname).toBe('/ar/reset-password');
  });

  it('never follows an external next URL', async () => {
    const response = await GET(
      req('?token_hash=secret&type=recovery&next=https%3A%2F%2Fevil.example'),
    );
    const location = locationOf(response);
    expect(location.origin).toBe('http://localhost:3000');
    expect(location.pathname).toBe('/en/reset-password');
    expect(location.href).not.toContain('evil.example');
  });

  it('supports locale-prefixed legacy next values without using them as destinations', async () => {
    const response = await GET(req('?token_hash=secret&type=recovery&next=%2Far%2Freset-password'));
    expect(locationOf(response).pathname).toBe('/ar/reset-password');
  });

  it('rejects non-recovery OTP types and does not reflect the token', async () => {
    const response = await GET(req('?token_hash=secret&type=signup&locale=ar'));
    expect(verifyOtp).not.toHaveBeenCalled();
    const location = locationOf(response);
    expect(location.pathname).toBe('/ar/reset-password');
    expect(location.searchParams.get('error')).toBe('invalid');
    expect(location.href).not.toContain('secret');
  });
});
