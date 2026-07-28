function origin(value) {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function websocketOrigin(value) {
  const parsed = origin(value);
  if (!parsed) return null;
  return parsed.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
}

function cspValue(env, app) {
  const supabaseOrigin = origin(env.NEXT_PUBLIC_SUPABASE_URL);
  const realtimeOrigin = websocketOrigin(env.NEXT_PUBLIC_SUPABASE_URL);
  const production = env.DEMO_ENVIRONMENT === 'production';
  const scripts = ["'self'", "'unsafe-inline'"];
  if (!production) scripts.push("'unsafe-eval'");

  const images = ["'self'", 'data:', 'blob:'];
  if (supabaseOrigin) images.push(supabaseOrigin);
  if (app === 'web') {
    images.push(
      'https://images.bayut.com',
      'https://bayut-production.s3.eu-central-1.amazonaws.com',
    );
  }

  const connections = ["'self'"];
  if (supabaseOrigin) connections.push(supabaseOrigin);
  if (realtimeOrigin) connections.push(realtimeOrigin);

  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "frame-src 'none'",
    `script-src ${scripts.join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    `img-src ${images.join(' ')}`,
    `connect-src ${connections.join(' ')}`,
    "media-src 'self'",
    "manifest-src 'self'",
    "worker-src 'self' blob:",
    "form-action 'self'",
  ];
  if (production) directives.push('upgrade-insecure-requests');
  return directives.join('; ');
}

/** Provider-neutral response headers for every page and API response. */
export function securityHeaders(env = process.env, app = 'web') {
  const headers = [
    { key: 'Content-Security-Policy', value: cspValue(env, app) },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    {
      key: 'Permissions-Policy',
      value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    },
    { key: 'Cross-Origin-Resource-Policy', value: 'same-site' },
    { key: 'X-DNS-Prefetch-Control', value: 'off' },
  ];

  const appUrl = app === 'admin' ? env.NEXT_PUBLIC_ADMIN_URL : env.NEXT_PUBLIC_WEB_URL;
  if (env.DEMO_ENVIRONMENT === 'production' && origin(appUrl)?.startsWith('https://')) {
    headers.push({
      key: 'Strict-Transport-Security',
      value: 'max-age=31536000',
    });
  }
  return headers;
}
