/**
 * UAE PASS Staging (POC) configuration — SERVER-side values only.
 *
 * UAE PASS is wired as a Supabase Auth **Custom OAuth2 provider** (`custom:uae-pass`).
 * The OAuth code/token/userinfo exchange, the resulting Supabase session, and
 * account resolution by the provider subject are all handled by Supabase Auth
 * (GoTrue) — NOT by hand-rolled code, custom JWTs, or the service-role key at login.
 * This module only:
 *   - exposes the server-controlled MODE (simulated is the default), and
 *   - builds the provider config that the idempotent setup script registers with
 *     GoTrue's admin API.
 *
 * The staging endpoint HOSTS are ALLOW-LISTED in code (never taken from an env var)
 * to avoid an SSRF / token-disclosure risk. Values verified against docs.uaepass.ae.
 * Secrets come from server-only env — NEVER `NEXT_PUBLIC_`. This is STAGING / POC
 * only: not production identity verification, and not proof of property ownership.
 */

/** Supabase custom-provider identifier used by `signInWithOAuth`. */
export const UAE_PASS_PROVIDER = 'custom:uae-pass' as const;

/** Official UAE PASS STAGING endpoints (allow-listed; docs.uaepass.ae). */
export const UAE_PASS_STAGING_ENDPOINTS = {
  authorizationUrl: 'https://stg-id.uaepass.ae/idshub/authorize',
  tokenUrl: 'https://stg-id.uaepass.ae/idshub/token',
  userinfoUrl: 'https://stg-id.uaepass.ae/idshub/userinfo',
} as const;

/** POC defaults (docs.uaepass.ae): general-profile scope + web SOP-low ACR. */
const DEFAULT_SCOPE = 'urn:uae:digitalid:profile:general';
const DEFAULT_ACR = 'urn:safelayer:tws:policies:authentication:level:low';

export type UaePassMode = 'simulated' | 'staging';

/**
 * Server-controlled provider mode. Simulated is the DEFAULT so local development,
 * automated tests, and CI never require UAE PASS network access or credentials.
 */
export function getUaePassMode(): UaePassMode {
  return process.env.UAE_PASS_MODE === 'staging' ? 'staging' : 'simulated';
}

/** Whether the "Continue with UAE PASS Staging" sign-in option is active. */
export function isUaePassStagingEnabled(): boolean {
  return getUaePassMode() === 'staging';
}

export interface UaePassProviderConfig {
  providerType: 'oauth2';
  identifier: typeof UAE_PASS_PROVIDER;
  name: string;
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  userinfoUrl: string;
  scopes: string[];
  authorizationParams: Record<string, string>;
}

/**
 * Build the GoTrue custom-provider config from server-only env. Throws when the
 * credentials are missing (only needed in staging mode, by the setup script).
 * Endpoint HOSTS are never read from env — always the allow-listed staging URLs.
 * For the POC, the published `sandbox_stage` / `sandbox_stage` credentials may be
 * supplied locally.
 */
export function getUaePassProviderConfig(): UaePassProviderConfig {
  const clientId = process.env.UAE_PASS_CLIENT_ID;
  const clientSecret = process.env.UAE_PASS_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      'UAE_PASS_CLIENT_ID / UAE_PASS_CLIENT_SECRET are required to register the UAE PASS ' +
        'staging provider. For the POC use the published sandbox_stage credentials. ' +
        'See docs/integrations/uae-pass-staging-poc.md.',
    );
  }
  const scope = process.env.UAE_PASS_SCOPE?.trim() || DEFAULT_SCOPE;
  const acr = process.env.UAE_PASS_ACR_VALUES?.trim() || DEFAULT_ACR;
  return {
    providerType: 'oauth2',
    identifier: UAE_PASS_PROVIDER,
    name: 'UAE PASS Staging',
    clientId,
    clientSecret,
    ...UAE_PASS_STAGING_ENDPOINTS,
    scopes: scope.split(/\s+/).filter(Boolean),
    authorizationParams: { acr_values: acr },
  };
}
