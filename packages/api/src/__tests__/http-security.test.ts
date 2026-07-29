import { describe, expect, it } from 'vitest';
import { getHttpRequestOrigin, isTrustedHttpRequestOrigin } from '../http-security';

describe('tRPC HTTP origin boundary', () => {
  const allowedOrigin = 'https://app.example.test';

  it('allows safe reads without an Origin header', () => {
    expect(isTrustedHttpRequestOrigin({ method: 'GET', origin: null, allowedOrigin })).toBe(true);
  });

  it('allows a POST only from the exact configured origin', () => {
    expect(
      isTrustedHttpRequestOrigin({
        method: 'POST',
        origin: 'https://app.example.test',
        allowedOrigin,
      }),
    ).toBe(true);
  });

  it('rejects sibling origins and absent origins for POST requests', () => {
    expect(
      isTrustedHttpRequestOrigin({
        method: 'POST',
        origin: 'https://admin.example.test',
        allowedOrigin,
      }),
    ).toBe(false);
    expect(isTrustedHttpRequestOrigin({ method: 'POST', origin: null, allowedOrigin })).toBe(false);
  });

  it('fails closed when the configured origin is missing or malformed', () => {
    expect(
      isTrustedHttpRequestOrigin({
        method: 'POST',
        origin: 'https://app.example.test',
        allowedOrigin: undefined,
      }),
    ).toBe(false);
    expect(
      isTrustedHttpRequestOrigin({
        method: 'POST',
        origin: 'https://app.example.test',
        allowedOrigin: 'not-a-url',
      }),
    ).toBe(false);
  });

  it('allows a POST whose Origin matches the origin the request was served on', () => {
    expect(
      isTrustedHttpRequestOrigin({
        method: 'POST',
        origin: 'https://www.example.test',
        requestOrigin: 'https://www.example.test',
        allowedOrigin,
      }),
    ).toBe(true);
  });

  it('rejects a cross-site POST even when a request origin is provided', () => {
    expect(
      isTrustedHttpRequestOrigin({
        method: 'POST',
        origin: 'https://attacker.example',
        requestOrigin: 'https://www.example.test',
        allowedOrigin,
      }),
    ).toBe(false);
  });

  it('fails closed when both request origin and configured origin are absent', () => {
    expect(
      isTrustedHttpRequestOrigin({
        method: 'POST',
        origin: 'https://app.example.test',
        requestOrigin: null,
        allowedOrigin: undefined,
      }),
    ).toBe(false);
  });
});

describe('getHttpRequestOrigin', () => {
  it('prefers the forwarded host and proto headers', () => {
    const req = new Request('http://internal:3000/api/trpc/x', {
      headers: { 'x-forwarded-host': 'www.example.test', 'x-forwarded-proto': 'https' },
    });
    expect(getHttpRequestOrigin(req)).toBe('https://www.example.test');
  });

  it('uses only the first value of comma-separated forwarded headers', () => {
    const req = new Request('http://internal:3000/api/trpc/x', {
      headers: {
        'x-forwarded-host': 'www.example.test, proxy.internal',
        'x-forwarded-proto': 'https, http',
      },
    });
    expect(getHttpRequestOrigin(req)).toBe('https://www.example.test');
  });

  it('falls back to the Host header and request protocol in local dev', () => {
    const req = new Request('http://localhost:3000/api/trpc/x', {
      headers: { host: 'localhost:3000' },
    });
    expect(getHttpRequestOrigin(req)).toBe('http://localhost:3000');
  });
});
