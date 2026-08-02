'use client';

import { createSupabaseBrowserClient } from './browser';

export const SESSION_INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;
export const SESSION_ACTIVITY_STORAGE_KEY = 'markaz.session.last-activity.v1';

const ACTIVITY_WRITE_THROTTLE_MS = 15 * 1000;

export function isSessionInactive(
  lastActivityAt: number,
  now: number,
  timeoutMs = SESSION_INACTIVITY_TIMEOUT_MS,
): boolean {
  return now - lastActivityAt >= timeoutMs;
}

function parseActivityTimestamp(value: string | null): number | null {
  if (value === null) return null;
  const timestamp = Number(value);
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : null;
}

/**
 * Ends a browser session after 30 minutes without MARKAZ interaction.
 *
 * The timestamp is intentionally the only value persisted by this component;
 * Supabase remains the sole owner of access and refresh tokens. localStorage
 * lets a returning or second tab enforce the same idle deadline immediately,
 * while GoTrue's inactivity policy remains the server-side boundary.
 */
export function startSessionInactivityGuard(redirectTo: string): () => void {
  const supabase = createSupabaseBrowserClient();
  let authenticated = false;
  let initialized = false;
  let expiring = false;
  let fallbackActivityAt: number | null = null;
  let lastPersistedAt = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const clearTimer = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };

  const readActivity = () => {
    try {
      const stored = parseActivityTimestamp(
        window.localStorage.getItem(SESSION_ACTIVITY_STORAGE_KEY),
      );
      if (stored !== null) fallbackActivityAt = stored;
    } catch {
      // Storage can be unavailable in hardened/private browser contexts. The
      // in-memory timer still protects the open tab; GoTrue protects returns.
    }
    return fallbackActivityAt;
  };

  const persistActivity = (timestamp: number) => {
    fallbackActivityAt = timestamp;
    lastPersistedAt = timestamp;
    try {
      window.localStorage.setItem(SESSION_ACTIVITY_STORAGE_KEY, String(timestamp));
    } catch {
      // See readActivity: in-memory + provider enforcement remain available.
    }
  };

  const clearActivity = () => {
    fallbackActivityAt = null;
    lastPersistedAt = 0;
    try {
      window.localStorage.removeItem(SESSION_ACTIVITY_STORAGE_KEY);
    } catch {
      // Nothing sensitive is left in application-managed storage.
    }
  };

  const expireSession = async () => {
    if (expiring || !authenticated) return;
    expiring = true;
    clearTimer();
    clearActivity();
    try {
      // An idle browser should not revoke a different, actively used device.
      await supabase.auth.signOut({ scope: 'local' });
    } finally {
      window.location.replace(redirectTo);
    }
  };

  const scheduleExpiry = (lastActivityAt: number) => {
    clearTimer();
    const remaining = SESSION_INACTIVITY_TIMEOUT_MS - (Date.now() - lastActivityAt);
    if (remaining <= 0) {
      void expireSession();
      return;
    }
    timer = setTimeout(() => void expireSession(), remaining);
  };

  const enforceCurrentDeadline = () => {
    if (!authenticated || expiring) return;
    const now = Date.now();
    const lastActivityAt = readActivity();
    if (lastActivityAt === null) {
      persistActivity(now);
      scheduleExpiry(now);
      return;
    }
    lastPersistedAt = lastActivityAt;
    if (isSessionInactive(lastActivityAt, now)) {
      void expireSession();
      return;
    }
    scheduleExpiry(lastActivityAt);
  };

  const recordActivity = () => {
    if (!initialized || !authenticated || expiring) return;
    const now = Date.now();
    const lastActivityAt = readActivity();
    // Check the old deadline before recording the new interaction. This is
    // important when focus returns to a tab after the idle period elapsed.
    if (lastActivityAt !== null && isSessionInactive(lastActivityAt, now)) {
      void expireSession();
      return;
    }
    if (lastActivityAt === null || now - lastPersistedAt >= ACTIVITY_WRITE_THROTTLE_MS) {
      persistActivity(now);
      scheduleExpiry(now);
    }
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') recordActivity();
  };

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== SESSION_ACTIVITY_STORAGE_KEY || !authenticated || expiring) return;
    const timestamp = parseActivityTimestamp(event.newValue);
    if (timestamp === null) {
      // Manual or idle sign-out in another tab invalidates this tab too.
      void expireSession();
      return;
    }
    fallbackActivityAt = timestamp;
    lastPersistedAt = timestamp;
    if (isSessionInactive(timestamp, Date.now())) {
      void expireSession();
      return;
    }
    scheduleExpiry(timestamp);
  };

  const activityEvents: Array<keyof WindowEventMap> = [
    'keydown',
    'pointerdown',
    'pointermove',
    'scroll',
    'touchstart',
  ];
  activityEvents.forEach((eventName) =>
    window.addEventListener(eventName, recordActivity, { passive: true }),
  );
  window.addEventListener('focus', recordActivity);
  window.addEventListener('storage', handleStorage);
  document.addEventListener('visibilitychange', handleVisibilityChange);

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event, session) => {
    if (!initialized) return;
    if (event === 'SIGNED_OUT' || !session) {
      authenticated = false;
      clearTimer();
      clearActivity();
      return;
    }
    if (!authenticated) {
      authenticated = true;
      const now = Date.now();
      persistActivity(now);
      scheduleExpiry(now);
      return;
    }
    // SIGNED_IN can also be emitted when an existing tab regains focus. It
    // must enforce the stored deadline, not silently extend it.
    enforceCurrentDeadline();
  });

  void supabase.auth
    .getSession()
    .then(({ data: { session } }) => {
      if (expiring) return;
      initialized = true;
      authenticated = session !== null;
      if (!authenticated) {
        clearActivity();
        return;
      }
      enforceCurrentDeadline();
    })
    .catch(() => {
      // A provider/cookie read failure must not leave a stale app-managed
      // activity marker or an unhandled rejection on a public route.
      initialized = true;
      authenticated = false;
      clearTimer();
      clearActivity();
    });

  return () => {
    clearTimer();
    subscription.unsubscribe();
    activityEvents.forEach((eventName) => window.removeEventListener(eventName, recordActivity));
    window.removeEventListener('focus', recordActivity);
    window.removeEventListener('storage', handleStorage);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}
