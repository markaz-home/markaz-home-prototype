/**
 * Browser tRPC requests are same-origin only. Cookies are SameSite, but exact
 * Origin validation also blocks same-site sibling-origin CSRF. GET/HEAD remain
 * available for safe public queries and health probes.
 *
 * A state-changing request is trusted when its Origin header exactly matches
 * either the origin the request was actually served on (derived from the
 * platform-set forwarded headers) or the configured app origin. The request's
 * own origin is authoritative — an attacker's cross-site page always sends its
 * own Origin, which can never equal the host it is attacking — and it keeps
 * every legitimate serving domain (apex, www, preview deployments) working
 * without env coordination.
 */
export function isTrustedHttpRequestOrigin({
  method,
  origin,
  requestOrigin,
  allowedOrigin,
}: {
  method: string;
  origin: string | null;
  requestOrigin?: string | null;
  allowedOrigin: string | undefined;
}): boolean {
  const normalizedMethod = method.toUpperCase();
  if (normalizedMethod === 'GET' || normalizedMethod === 'HEAD') return true;
  if (!origin) return false;

  let requesterOrigin: string;
  try {
    requesterOrigin = new URL(origin).origin;
  } catch {
    return false;
  }

  for (const candidate of [requestOrigin, allowedOrigin]) {
    if (!candidate) continue;
    try {
      if (new URL(candidate).origin === requesterOrigin) return true;
    } catch {
      // Malformed candidate: skip it and fail closed on the remaining ones.
    }
  }
  return false;
}

/**
 * The origin the request was actually served on. Prefers the proxy-set
 * forwarded headers (set by the platform edge, not spoofable by browsers)
 * and falls back to the request URL for local dev.
 */
export function getHttpRequestOrigin(req: Request): string | null {
  const forwardedHost = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const host = forwardedHost || req.headers.get('host');
  if (!host) return null;
  const forwardedProto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  let proto = forwardedProto;
  if (!proto) {
    try {
      proto = new URL(req.url).protocol.replace(':', '');
    } catch {
      return null;
    }
  }
  return `${proto}://${host}`;
}
