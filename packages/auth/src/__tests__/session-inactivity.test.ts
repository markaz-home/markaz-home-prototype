// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getSession, onAuthStateChange, signOut, unsubscribe } = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signOut: vi.fn(),
  unsubscribe: vi.fn(),
}));

vi.mock('../browser', () => ({
  createSupabaseBrowserClient: () => ({
    auth: { getSession, onAuthStateChange, signOut },
  }),
}));

import {
  isSessionInactive,
  SESSION_ACTIVITY_STORAGE_KEY,
  SESSION_INACTIVITY_TIMEOUT_MS,
  startSessionInactivityGuard,
} from '../session-inactivity';

const activeSession = { user: { id: 'user-1' } };

async function settleSessionLookup() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-08-02T08:00:00.000Z'));
  window.localStorage.clear();
  getSession.mockReset().mockResolvedValue({ data: { session: activeSession } });
  onAuthStateChange.mockReset().mockReturnValue({ data: { subscription: { unsubscribe } } });
  // Keep expiry pending so jsdom is not asked to perform a real navigation.
  signOut.mockReset().mockReturnValue(new Promise(() => undefined));
  unsubscribe.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('session inactivity deadline', () => {
  it('expires at the exact 30-minute boundary', () => {
    const now = Date.now();
    expect(isSessionInactive(now - SESSION_INACTIVITY_TIMEOUT_MS + 1, now)).toBe(false);
    expect(isSessionInactive(now - SESSION_INACTIVITY_TIMEOUT_MS, now)).toBe(true);
  });

  it('starts a deadline for an existing session without storing auth credentials', async () => {
    const stop = startSessionInactivityGuard('/en/sign-in?notice=session-expired');
    await settleSessionLookup();

    expect(window.localStorage).toHaveLength(1);
    expect(window.localStorage.getItem(SESSION_ACTIVITY_STORAGE_KEY)).toBe(String(Date.now()));
    expect(signOut).not.toHaveBeenCalled();

    stop();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it('signs out immediately when a browser returns after the deadline', async () => {
    window.localStorage.setItem(
      SESSION_ACTIVITY_STORAGE_KEY,
      String(Date.now() - SESSION_INACTIVITY_TIMEOUT_MS),
    );

    const stop = startSessionInactivityGuard('/en/sign-in?notice=session-expired');
    await settleSessionLookup();

    expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(window.localStorage.getItem(SESSION_ACTIVITY_STORAGE_KEY)).toBeNull();
    stop();
  });

  it('extends the deadline after real interaction but not before the throttle window', async () => {
    const initialActivity = Date.now();
    window.localStorage.setItem(SESSION_ACTIVITY_STORAGE_KEY, String(initialActivity));
    const stop = startSessionInactivityGuard('/en/sign-in?notice=session-expired');
    await settleSessionLookup();

    vi.advanceTimersByTime(15_000);
    window.dispatchEvent(new Event('pointerdown'));
    expect(window.localStorage.getItem(SESSION_ACTIVITY_STORAGE_KEY)).toBe(String(Date.now()));

    vi.advanceTimersByTime(SESSION_INACTIVITY_TIMEOUT_MS - 1);
    expect(signOut).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
    stop();
  });

  it('ends another tab when the shared activity marker is cleared', async () => {
    window.localStorage.setItem(SESSION_ACTIVITY_STORAGE_KEY, String(Date.now()));
    const stop = startSessionInactivityGuard('/en/sign-in?notice=session-expired');
    await settleSessionLookup();

    window.dispatchEvent(
      new StorageEvent('storage', {
        key: SESSION_ACTIVITY_STORAGE_KEY,
        oldValue: String(Date.now()),
        newValue: null,
      }),
    );

    expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
    stop();
  });

  it('clears stale activity state when the provider session cannot be read', async () => {
    window.localStorage.setItem(SESSION_ACTIVITY_STORAGE_KEY, String(Date.now()));
    getSession.mockRejectedValue(new Error('provider unavailable'));

    const stop = startSessionInactivityGuard('/en/sign-in?notice=session-expired');
    await settleSessionLookup();

    expect(window.localStorage.getItem(SESSION_ACTIVITY_STORAGE_KEY)).toBeNull();
    expect(signOut).not.toHaveBeenCalled();
    stop();
  });
});
