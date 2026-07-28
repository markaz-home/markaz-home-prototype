/**
 * Browser tRPC requests are same-origin only. Cookies are SameSite, but exact
 * Origin validation also blocks same-site sibling-origin CSRF. GET/HEAD remain
 * available for safe public queries and health probes.
 */
export function isTrustedHttpRequestOrigin({
  method,
  origin,
  allowedOrigin,
}: {
  method: string;
  origin: string | null;
  allowedOrigin: string | undefined;
}): boolean {
  const normalizedMethod = method.toUpperCase();
  if (normalizedMethod === 'GET' || normalizedMethod === 'HEAD') return true;
  if (!origin || !allowedOrigin) return false;
  try {
    return new URL(origin).origin === new URL(allowedOrigin).origin;
  } catch {
    return false;
  }
}
