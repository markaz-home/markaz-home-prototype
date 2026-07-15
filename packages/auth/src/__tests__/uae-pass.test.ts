import { describe, it, expect, afterEach } from 'vitest';
import {
  UAE_PASS_PROVIDER,
  UAE_PASS_STAGING_ENDPOINTS,
  getUaePassMode,
  isUaePassStagingEnabled,
  getUaePassProviderConfig,
} from '../uae-pass';

const ENV_KEYS = [
  'UAE_PASS_MODE',
  'UAE_PASS_CLIENT_ID',
  'UAE_PASS_CLIENT_SECRET',
  'UAE_PASS_SCOPE',
  'UAE_PASS_ACR_VALUES',
];

afterEach(() => {
  for (const k of ENV_KEYS) delete process.env[k];
});

describe('UAE PASS config (POC)', () => {
  it('defaults to simulated mode (no network/creds needed for local/tests/CI)', () => {
    expect(getUaePassMode()).toBe('simulated');
    expect(isUaePassStagingEnabled()).toBe(false);
  });

  it('is staging only when explicitly set', () => {
    process.env.UAE_PASS_MODE = 'staging';
    expect(getUaePassMode()).toBe('staging');
    expect(isUaePassStagingEnabled()).toBe(true);
  });

  it('uses the official stg-id.uaepass.ae idshub endpoints (allow-listed in code)', () => {
    expect(UAE_PASS_STAGING_ENDPOINTS.authorizationUrl).toBe(
      'https://stg-id.uaepass.ae/idshub/authorize',
    );
    expect(UAE_PASS_STAGING_ENDPOINTS.tokenUrl).toBe('https://stg-id.uaepass.ae/idshub/token');
    expect(UAE_PASS_STAGING_ENDPOINTS.userinfoUrl).toBe(
      'https://stg-id.uaepass.ae/idshub/userinfo',
    );
    expect(UAE_PASS_PROVIDER).toBe('custom:uae-pass');
  });

  it('throws when credentials are missing (never silently mis-registers)', () => {
    expect(() => getUaePassProviderConfig()).toThrow(/UAE_PASS_CLIENT_ID/);
  });

  it('builds the provider config with allow-listed hosts + documented scope/acr defaults', () => {
    process.env.UAE_PASS_CLIENT_ID = 'sandbox_stage';
    process.env.UAE_PASS_CLIENT_SECRET = 'sandbox_stage';
    const cfg = getUaePassProviderConfig();
    expect(cfg.providerType).toBe('oauth2');
    expect(cfg.identifier).toBe('custom:uae-pass');
    expect(cfg.clientId).toBe('sandbox_stage');
    // Endpoints come from the code allow-list, NOT from env (SSRF safety).
    expect(cfg.authorizationUrl).toBe('https://stg-id.uaepass.ae/idshub/authorize');
    expect(cfg.tokenUrl).toBe('https://stg-id.uaepass.ae/idshub/token');
    expect(cfg.userinfoUrl).toBe('https://stg-id.uaepass.ae/idshub/userinfo');
    // Documented defaults.
    expect(cfg.scopes).toEqual(['urn:uae:digitalid:profile:general']);
    expect(cfg.authorizationParams.acr_values).toBe(
      'urn:safelayer:tws:policies:authentication:level:low',
    );
  });

  it('does not allow environment variables to widen the POC scope or change its ACR', () => {
    process.env.UAE_PASS_CLIENT_ID = 'x';
    process.env.UAE_PASS_CLIENT_SECRET = 'y';
    process.env.UAE_PASS_SCOPE =
      'urn:uae:digitalid:profile:general urn:uae:digitalid:profile:general:unifiedId';
    process.env.UAE_PASS_ACR_VALUES = 'custom:acr';
    const cfg = getUaePassProviderConfig();
    expect(cfg.scopes).toEqual(['urn:uae:digitalid:profile:general']);
    expect(cfg.authorizationParams.acr_values).toBe(
      'urn:safelayer:tws:policies:authentication:level:low',
    );
  });
});
