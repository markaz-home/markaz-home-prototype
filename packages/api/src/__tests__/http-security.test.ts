import { describe, expect, it } from 'vitest';
import { isTrustedHttpRequestOrigin } from '../http-security';

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
});
