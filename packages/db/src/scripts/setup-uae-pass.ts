/* eslint-disable no-console */
/**
 * UAE PASS Staging (POC) — register the Supabase custom OAuth provider.
 *
 * Wires UAE PASS as a Supabase Auth Custom OAuth2 provider (`custom:uae-pass`) so
 * `supabase.auth.signInWithOAuth({ provider: 'custom:uae-pass' })` performs a REAL
 * staging OAuth login that yields a STANDARD Supabase session (auth.uid()/RLS
 * unchanged). The GoTrue admin API stores providers in the Auth DB (not config.toml),
 * so this idempotent script (re)registers it after a fresh `supabase start`.
 *
 * This uses the service-role key for ADMIN CONFIGURATION ONLY — never during a
 * customer login. Endpoint HOSTS are allow-listed in @markaz/auth/uae-pass (never
 * from env), avoiding SSRF/token-disclosure. Simulated mode (the default) is a no-op.
 *
 *   UAE_PASS_MODE=staging \
 *   UAE_PASS_CLIENT_ID=sandbox_stage UAE_PASS_CLIENT_SECRET=sandbox_stage \
 *   pnpm db:setup-uae-pass
 *
 * See docs/integrations/uae-pass-staging-poc.md. Never logs the client secret.
 */
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { getUaePassMode, getUaePassProviderConfig } from '@markaz/auth/uae-pass';

// Local-first: .env.local (local stack) wins over .env (hosted contract).
for (const p of [
  resolve(process.cwd(), '../../.env.local'),
  resolve(process.cwd(), '.env.local'),
  resolve(process.cwd(), '../../.env'),
  resolve(process.cwd(), '.env'),
]) {
  if (existsSync(p)) config({ path: p });
}

function fail(msg: string): never {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

function isLoopbackSupabase(url: string): boolean {
  try {
    return ['127.0.0.1', 'localhost', '::1'].includes(new URL(url).hostname);
  } catch {
    return false;
  }
}

async function main() {
  if (getUaePassMode() !== 'staging') {
    console.log('→ UAE_PASS_MODE is not "staging" — nothing to register (simulated mode).');
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey)
    fail('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are required.');
  if (!isLoopbackSupabase(url) && process.env.UAE_PASS_ALLOW_REMOTE_SETUP !== 'true') {
    fail(
      'Refusing to configure a non-loopback Supabase Auth tenant. Set ' +
        'UAE_PASS_ALLOW_REMOTE_SETUP=true only when you intentionally want to update that tenant.',
    );
  }

  const cfg = getUaePassProviderConfig();
  // GoTrue admin API payload (snake_case). Never printed.
  const payload = {
    provider_type: cfg.providerType,
    identifier: cfg.identifier,
    name: cfg.name,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    authorization_url: cfg.authorizationUrl,
    token_url: cfg.tokenUrl,
    userinfo_url: cfg.userinfoUrl,
    scopes: cfg.scopes,
    authorization_params: cfg.authorizationParams,
    enabled: true,
  };

  const base = `${url.replace(/\/$/, '')}/auth/v1/admin/custom-providers`;
  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  };
  // GoTrue addresses a provider by its raw `custom:<name>` identifier in the path
  // (the ':' must NOT be percent-encoded, or it 404s). `<name>` is a safe slug.
  const byId = `${base}/${cfg.identifier}`;

  const existing = await fetch(byId, { headers }).catch(() => null);
  const exists = existing?.status === 200;

  const res = await fetch(exists ? byId : base, {
    method: exists ? 'PUT' : 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const safeBody = body.replaceAll(cfg.clientSecret, '[REDACTED]').slice(0, 1_000);
    fail(
      `GoTrue custom-provider ${exists ? 'update' : 'create'} failed ` +
        `(HTTP ${res.status}): ${safeBody}`,
    );
  }

  console.log(
    `✓ UAE PASS staging provider ${exists ? 'updated' : 'registered'} as ${cfg.identifier} ` +
      `(client_id=${cfg.clientId}, scopes=${cfg.scopes.join(' ')}).`,
  );
  console.log(
    '  UAE PASS / GoTrue redirect callback: ' + `${url.replace(/\/$/, '')}/auth/v1/callback`,
  );
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e)));
