import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EnvironmentValidationError, validateEnvironment } from './environment.mjs';

const validLocal = {
  NEXT_PUBLIC_WEB_URL: 'http://localhost:3000',
  NEXT_PUBLIC_ADMIN_URL: 'http://localhost:3001',
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'local-anon-placeholder',
  NEXT_PUBLIC_DEFAULT_LOCALE: 'en',
  NEXT_PUBLIC_SUPPORTED_LOCALES: 'en,ar',
  DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
  DIRECT_DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
  SUPABASE_SERVICE_ROLE_KEY: 'local-service-placeholder',
  DEMO_ENVIRONMENT: 'local',
  DEMO_AUTH_FALLBACK: 'false',
  UAE_PASS_MODE: 'simulated',
  BAYUT_API_MODE: 'disabled',
};

function issuesFor(overrides) {
  try {
    validateEnvironment({ ...validLocal, ...overrides });
    return [];
  } catch (error) {
    assert.ok(error instanceof EnvironmentValidationError);
    return error.issues;
  }
}

describe('validateEnvironment', () => {
  it('accepts the safe local prototype configuration and emits adapter notices', () => {
    const result = validateEnvironment(validLocal, { app: 'web' });
    assert.equal(result.app, 'web');
    assert.equal(result.uaePassMode, 'simulated');
    assert.ok(result.warnings.some((warning) => warning.includes('BayutAPI')));
  });

  it('fails fast with variable names when required configuration is missing', () => {
    assert.ok(issuesFor({ DATABASE_URL: '' }).some((issue) => issue.includes('DATABASE_URL')));
  });

  it('rejects malformed public URLs and client-exposed secret names', () => {
    const issues = issuesFor({
      NEXT_PUBLIC_WEB_URL: 'not-a-url',
      NEXT_PUBLIC_DATABASE_PASSWORD: 'unsafe',
    });
    assert.ok(issues.some((issue) => issue.includes('NEXT_PUBLIC_WEB_URL')));
    assert.ok(issues.some((issue) => issue.includes('NEXT_PUBLIC_DATABASE_PASSWORD')));
  });

  it('requires separate customer and Admin origins', () => {
    assert.ok(
      issuesFor({ NEXT_PUBLIC_ADMIN_URL: validLocal.NEXT_PUBLIC_WEB_URL }).some((issue) =>
        issue.includes('separate origins'),
      ),
    );
  });

  it('requires HTTPS for controlled non-local environments', () => {
    assert.ok(issuesFor({ DEMO_ENVIRONMENT: 'staging' }).some((issue) => issue.includes('HTTPS')));
  });

  it('requires UAE PASS credentials only when staging mode is enabled', () => {
    assert.ok(
      issuesFor({ UAE_PASS_MODE: 'staging' }).some((issue) => issue.includes('UAE_PASS_CLIENT_ID')),
    );
  });

  it('never allows UAE PASS staging endpoints in production', () => {
    const issues = issuesFor({
      DEMO_ENVIRONMENT: 'production',
      NEXT_PUBLIC_WEB_URL: 'https://example.test',
      NEXT_PUBLIC_ADMIN_URL: 'https://admin.example.test',
      NEXT_PUBLIC_SUPABASE_URL: 'https://supabase.example.test',
      DATABASE_URL: 'postgresql://app:placeholder@pool.example.test/postgres',
      DIRECT_DATABASE_URL: 'postgresql://admin:placeholder@db.example.test/postgres',
      UAE_PASS_MODE: 'staging',
      UAE_PASS_CLIENT_ID: 'placeholder',
      UAE_PASS_CLIENT_SECRET: 'placeholder',
    });
    assert.ok(issues.some((issue) => issue.includes('cannot be enabled')));
  });

  it('requires the Bayut key in rapidapi mode and keeps it disabled in production', () => {
    assert.ok(
      issuesFor({ BAYUT_API_MODE: 'rapidapi' }).some((issue) => issue.includes('BAYUT_API_KEY')),
    );
  });

  it('rejects the unimplemented demo-auth fallback', () => {
    assert.ok(
      issuesFor({ DEMO_AUTH_FALLBACK: 'true' }).some((issue) =>
        issue.includes('must remain false'),
      ),
    );
  });

  it('requires Admin bootstrap credentials as a pair', () => {
    assert.ok(
      issuesFor({ BOOTSTRAP_ADMIN_EMAIL: 'admin@example.test' }).some((issue) =>
        issue.includes('configured together'),
      ),
    );
  });

  it('validates logging configuration without exposing values', () => {
    const issues = issuesFor({ LOG_LEVEL: 'verbose', SLOW_REQUEST_MS: '0' });
    assert.ok(issues.some((issue) => issue.includes('LOG_LEVEL')));
    assert.ok(issues.some((issue) => issue.includes('SLOW_REQUEST_MS')));
  });

  it('rejects a privileged key in the public Supabase slot', () => {
    assert.ok(
      issuesFor({ NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sb_secret_not-public' }).some((issue) =>
        issue.includes('public anon'),
      ),
    );
  });
});
