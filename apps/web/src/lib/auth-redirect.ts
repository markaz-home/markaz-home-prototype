const DEFAULT_POST_SIGN_IN_DESTINATION = '/dashboard';

// Add authenticated entry points deliberately. Do not turn this into a generic
// relative-URL redirect: the value originates in the browser's query string.
const ALLOWED_POST_SIGN_IN_DESTINATIONS = new Set(['/sell']);

/** Resolve a user-controlled `next` value to a known customer-app destination. */
export function resolvePostSignInDestination(candidate: string | null): string {
  if (!candidate || !ALLOWED_POST_SIGN_IN_DESTINATIONS.has(candidate)) {
    return DEFAULT_POST_SIGN_IN_DESTINATION;
  }
  return candidate;
}
