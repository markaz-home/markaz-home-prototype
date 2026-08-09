const REQUIRED_BASE = [
  'NEXT_PUBLIC_WEB_URL',
  'NEXT_PUBLIC_ADMIN_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_DEFAULT_LOCALE',
  'NEXT_PUBLIC_SUPPORTED_LOCALES',
  'DATABASE_URL',
  'DIRECT_DATABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
];

export const CANONICAL_STORAGE_BUCKETS = Object.freeze({
  ownershipDocuments: 'ownership-documents',
  draftListingPhotos: 'listing-photos-draft',
  publicListingPhotos: 'listing-photos',
  transactionDocuments: 'transaction-documents',
});

const BOOLEAN_VALUES = new Set(['true', 'false']);
const LOG_LEVELS = new Set(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']);
const DEPLOYMENT_ENVIRONMENTS = new Set(['local', 'staging', 'production']);
const UAE_PASS_MODES = new Set(['simulated', 'staging']);
const BAYUT_API_MODES = new Set(['disabled', 'rapidapi']);
const LOCALES = new Set(['en', 'ar']);

export class EnvironmentValidationError extends Error {
  constructor(issues) {
    super(`Environment validation failed:\n${issues.map((issue) => `- ${issue}`).join('\n')}`);
    this.name = 'EnvironmentValidationError';
    this.issues = issues;
  }
}

function trimmed(env, name) {
  const value = env[name];
  return typeof value === 'string' ? value.trim() : '';
}

function validateUrl(env, name, protocols, issues) {
  const value = trimmed(env, name);
  if (!value) return null;
  try {
    const url = new URL(value);
    if (!protocols.includes(url.protocol)) {
      issues.push(`${name} must use ${protocols.join(' or ')}.`);
      return null;
    }
    if (url.username || url.password) {
      if (name.startsWith('NEXT_PUBLIC_')) {
        issues.push(`${name} must not contain embedded credentials.`);
      }
    }
    return url;
  } catch {
    issues.push(`${name} must be a valid URL.`);
    return null;
  }
}

function validateBoolean(env, name, issues) {
  const value = trimmed(env, name);
  if (value && !BOOLEAN_VALUES.has(value)) {
    issues.push(`${name} must be "true" or "false".`);
  }
  return value === 'true';
}

function requirePair(env, first, second, issues) {
  const hasFirst = Boolean(trimmed(env, first));
  const hasSecond = Boolean(trimmed(env, second));
  if (hasFirst !== hasSecond) {
    issues.push(`${first} and ${second} must be configured together.`);
  }
}

/**
 * Validate the environment without returning or logging secret values.
 *
 * `DEMO_ENVIRONMENT` describes the deployed environment. `NODE_ENV=production`
 * alone is not sufficient because a local `next build` also sets NODE_ENV.
 */
export function validateEnvironment(env = process.env, { app = 'all' } = {}) {
  const issues = [];
  const warnings = [];

  for (const name of REQUIRED_BASE) {
    if (!trimmed(env, name)) issues.push(`${name} is required.`);
  }

  const webUrl = validateUrl(env, 'NEXT_PUBLIC_WEB_URL', ['http:', 'https:'], issues);
  const adminUrl = validateUrl(env, 'NEXT_PUBLIC_ADMIN_URL', ['http:', 'https:'], issues);
  const supabaseUrl = validateUrl(env, 'NEXT_PUBLIC_SUPABASE_URL', ['http:', 'https:'], issues);
  const databaseUrl = validateUrl(env, 'DATABASE_URL', ['postgres:', 'postgresql:'], issues);
  const directDatabaseUrl = validateUrl(
    env,
    'DIRECT_DATABASE_URL',
    ['postgres:', 'postgresql:'],
    issues,
  );

  if (webUrl && (webUrl.pathname !== '/' || webUrl.search || webUrl.hash)) {
    issues.push('NEXT_PUBLIC_WEB_URL must be an origin without a path, query, or fragment.');
  }
  if (adminUrl && (adminUrl.pathname !== '/' || adminUrl.search || adminUrl.hash)) {
    issues.push('NEXT_PUBLIC_ADMIN_URL must be an origin without a path, query, or fragment.');
  }
  if (webUrl && adminUrl && webUrl.origin === adminUrl.origin) {
    issues.push('NEXT_PUBLIC_WEB_URL and NEXT_PUBLIC_ADMIN_URL must use separate origins.');
  }

  const deploymentEnvironment = trimmed(env, 'DEMO_ENVIRONMENT') || 'local';
  if (!DEPLOYMENT_ENVIRONMENTS.has(deploymentEnvironment)) {
    issues.push('DEMO_ENVIRONMENT must be local, staging, or production.');
  }

  if (deploymentEnvironment !== 'local') {
    for (const [name, url] of [
      ['NEXT_PUBLIC_WEB_URL', webUrl],
      ['NEXT_PUBLIC_ADMIN_URL', adminUrl],
      ['NEXT_PUBLIC_SUPABASE_URL', supabaseUrl],
    ]) {
      if (url && url.protocol !== 'https:') issues.push(`${name} must use HTTPS outside local.`);
    }
  }
  if (
    deploymentEnvironment === 'production' &&
    databaseUrl &&
    directDatabaseUrl &&
    databaseUrl.toString() === directDatabaseUrl.toString()
  ) {
    issues.push(
      'DATABASE_URL and DIRECT_DATABASE_URL must be distinct in production so pooled app traffic cannot front migrations or Realtime.',
    );
  }

  const anonKey = trimmed(env, 'NEXT_PUBLIC_SUPABASE_ANON_KEY');
  const serviceRoleKey = trimmed(env, 'SUPABASE_SERVICE_ROLE_KEY');
  if (anonKey.startsWith('sb_secret_') || anonKey.includes('service_role')) {
    issues.push('NEXT_PUBLIC_SUPABASE_ANON_KEY must contain only a public anon/publishable key.');
  }
  if (serviceRoleKey.startsWith('sb_publishable_')) {
    issues.push('SUPABASE_SERVICE_ROLE_KEY must not contain a publishable key.');
  }

  for (const name of Object.keys(env)) {
    if (
      name.startsWith('NEXT_PUBLIC_') &&
      /(SECRET|PASSWORD|SERVICE_ROLE|DATABASE|PRIVATE|TOKEN|API_KEY)/i.test(name) &&
      name !== 'NEXT_PUBLIC_SUPABASE_ANON_KEY'
    ) {
      issues.push(`${name} appears secret and must not be client-exposed.`);
    }
  }

  const defaultLocale = trimmed(env, 'NEXT_PUBLIC_DEFAULT_LOCALE');
  const supportedLocales = trimmed(env, 'NEXT_PUBLIC_SUPPORTED_LOCALES')
    .split(',')
    .map((locale) => locale.trim())
    .filter(Boolean);
  if (defaultLocale && !LOCALES.has(defaultLocale)) {
    issues.push('NEXT_PUBLIC_DEFAULT_LOCALE must be "en" or "ar".');
  }
  if (
    supportedLocales.length > 0 &&
    (supportedLocales.some((locale) => !LOCALES.has(locale)) ||
      !supportedLocales.includes('en') ||
      !supportedLocales.includes('ar'))
  ) {
    issues.push('NEXT_PUBLIC_SUPPORTED_LOCALES must contain the supported "en,ar" locale set.');
  }
  if (defaultLocale && supportedLocales.length && !supportedLocales.includes(defaultLocale)) {
    issues.push('NEXT_PUBLIC_DEFAULT_LOCALE must be included in NEXT_PUBLIC_SUPPORTED_LOCALES.');
  }

  const demoAuthFallback = validateBoolean(env, 'DEMO_AUTH_FALLBACK', issues);
  validateBoolean(env, 'UAE_PASS_ALLOW_REMOTE_SETUP', issues);
  validateBoolean(env, 'ANALYZE', issues);
  validateBoolean(env, 'PLAYWRIGHT_NO_SERVER', issues);
  if (demoAuthFallback) {
    issues.push('DEMO_AUTH_FALLBACK must remain false; the one-click fallback is not implemented.');
  } else {
    warnings.push('DEMO_AUTH_FALLBACK is disabled as required by ADR-0007.');
  }

  const uaePassMode = trimmed(env, 'UAE_PASS_MODE') || 'simulated';
  if (!UAE_PASS_MODES.has(uaePassMode)) {
    issues.push('UAE_PASS_MODE must be simulated or staging.');
  }
  if (uaePassMode === 'staging') {
    requirePair(env, 'UAE_PASS_CLIENT_ID', 'UAE_PASS_CLIENT_SECRET', issues);
    if (!trimmed(env, 'UAE_PASS_CLIENT_ID')) {
      issues.push('UAE_PASS staging mode requires UAE_PASS_CLIENT_ID and UAE_PASS_CLIENT_SECRET.');
    }
    if (deploymentEnvironment === 'production') {
      issues.push('UAE_PASS staging mode cannot be enabled in a production environment.');
    }
  } else {
    warnings.push('UAE PASS is in simulated/off mode; no real identity verification will run.');
  }
  if (
    deploymentEnvironment === 'production' &&
    trimmed(env, 'UAE_PASS_ALLOW_REMOTE_SETUP') === 'true'
  ) {
    issues.push('UAE_PASS_ALLOW_REMOTE_SETUP must not be true in production.');
  }

  const bayutApiMode = trimmed(env, 'BAYUT_API_MODE') || 'disabled';
  if (!BAYUT_API_MODES.has(bayutApiMode)) {
    issues.push('BAYUT_API_MODE must be disabled or rapidapi.');
  }
  if (bayutApiMode === 'rapidapi' && !trimmed(env, 'BAYUT_API_KEY')) {
    issues.push('BAYUT_API_MODE=rapidapi requires BAYUT_API_KEY.');
  }
  if (deploymentEnvironment === 'production' && bayutApiMode !== 'disabled') {
    issues.push(
      'BAYUT_API_MODE must remain disabled in production until redistribution permission is approved.',
    );
  }
  if (bayutApiMode === 'disabled') {
    warnings.push(
      'BayutAPI is disabled; only canonical MARKAZ marketplace data will be available.',
    );
  }

  requirePair(env, 'BOOTSTRAP_ADMIN_EMAIL', 'BOOTSTRAP_ADMIN_PASSWORD', issues);
  if (
    deploymentEnvironment === 'production' &&
    trimmed(env, 'BOOTSTRAP_ADMIN_EMAIL') &&
    trimmed(env, 'BOOTSTRAP_ADMIN_PASSWORD')
  ) {
    warnings.push(
      'Bootstrap admin credentials are present; remove or rotate them immediately after provisioning.',
    );
  }

  const slowRequest = trimmed(env, 'SLOW_REQUEST_MS');
  if (slowRequest) {
    const parsed = Number(slowRequest);
    if (!Number.isInteger(parsed) || parsed < 50 || parsed > 60_000) {
      issues.push('SLOW_REQUEST_MS must be an integer between 50 and 60000.');
    }
  }
  const logLevel = trimmed(env, 'LOG_LEVEL');
  if (logLevel && !LOG_LEVELS.has(logLevel)) {
    issues.push('LOG_LEVEL must be a supported pino log level.');
  }
  const serviceName = trimmed(env, 'SERVICE_NAME');
  if (serviceName && !/^[a-zA-Z0-9][a-zA-Z0-9._-]{1,63}$/.test(serviceName)) {
    issues.push('SERVICE_NAME must be 2–64 safe identifier characters.');
  }

  for (const bucket of Object.values(CANONICAL_STORAGE_BUCKETS)) {
    if (!/^[a-z0-9][a-z0-9-]{2,62}$/.test(bucket)) {
      issues.push('A canonical Storage bucket name is invalid.');
    }
  }

  warnings.push(
    'No external monitoring/error-tracking provider is configured; structured application logs are the current integration point.',
  );

  if (issues.length) throw new EnvironmentValidationError([...new Set(issues)]);
  return {
    app,
    deploymentEnvironment,
    uaePassMode,
    bayutApiMode,
    warnings: [...new Set(warnings)],
  };
}
