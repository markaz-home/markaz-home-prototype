import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { securityHeaders } from './security-headers.mjs';

const env = {
  NEXT_PUBLIC_WEB_URL: 'http://localhost:3000',
  NEXT_PUBLIC_ADMIN_URL: 'http://localhost:3001',
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
  DEMO_ENVIRONMENT: 'local',
};

describe('securityHeaders', () => {
  it('denies framing, MIME sniffing, sensitive browser capabilities, and foreign form actions', () => {
    const headers = new Map(securityHeaders(env, 'web').map(({ key, value }) => [key, value]));
    assert.equal(headers.get('X-Frame-Options'), 'DENY');
    assert.equal(headers.get('X-Content-Type-Options'), 'nosniff');
    assert.match(headers.get('Permissions-Policy'), /payment=\(\)/);
    assert.match(headers.get('Content-Security-Policy'), /frame-ancestors 'none'/);
    assert.match(headers.get('Content-Security-Policy'), /form-action 'self'/);
  });

  it('allows only the configured Supabase HTTP and Realtime origins', () => {
    const csp = new Map(securityHeaders(env, 'web').map(({ key, value }) => [key, value])).get(
      'Content-Security-Policy',
    );
    assert.match(csp, /http:\/\/127\.0\.0\.1:54321/);
    assert.match(csp, /ws:\/\/127\.0\.0\.1:54321/);
  });

  it('adds HSTS and removes unsafe-eval only for HTTPS production', () => {
    const production = {
      ...env,
      DEMO_ENVIRONMENT: 'production',
      NEXT_PUBLIC_WEB_URL: 'https://example.test',
    };
    const headers = new Map(
      securityHeaders(production, 'web').map(({ key, value }) => [key, value]),
    );
    assert.equal(headers.get('Strict-Transport-Security'), 'max-age=31536000');
    assert.doesNotMatch(headers.get('Content-Security-Policy'), /unsafe-eval/);
    assert.match(headers.get('Content-Security-Policy'), /upgrade-insecure-requests/);
  });

  it('does not allow third-party property images in the Admin app', () => {
    const csp = new Map(securityHeaders(env, 'admin').map(({ key, value }) => [key, value])).get(
      'Content-Security-Policy',
    );
    assert.doesNotMatch(csp, /images\.bayut\.com/);
  });
});
