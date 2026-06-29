/**
 * Anonymous "save property" interception (design spec §28). When a signed-out
 * visitor taps Save we persist a SHORT-LIVED, client-only intent, send them to
 * sign-in, and — once authenticated — return them to the property page and
 * complete the save idempotently.
 *
 * Stored in sessionStorage only: it never travels to the server, holds no
 * credentials/tokens/private listing data, and the return route is allow-listed
 * to the public property path (no open redirect).
 */
const KEY = 'markaz.saveIntent';
const TTL_MS = 30 * 60 * 1000; // 30 minutes

export interface SaveIntent {
  action: 'SAVE_PROPERTY';
  publicId: string;
  returnPath: string;
  locale: string;
  expiresAt: number;
}

/** Only relative `/{locale}/properties/{publicId}[/...]` routes are allowed back. */
export function isAllowedReturnPath(path: string): boolean {
  return /^\/(en|ar)\/properties\/[A-Za-z0-9-]+(\/[^?#\s]*)?$/.test(path);
}

export function storeSaveIntent(intent: Omit<SaveIntent, 'action' | 'expiresAt'>): void {
  if (typeof window === 'undefined') return;
  if (!isAllowedReturnPath(intent.returnPath)) return;
  const payload: SaveIntent = { action: 'SAVE_PROPERTY', expiresAt: Date.now() + TTL_MS, ...intent };
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    /* storage unavailable — interception degrades to a plain sign-in */
  }
}

export function readSaveIntent(): SaveIntent | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SaveIntent;
    if (
      parsed.action !== 'SAVE_PROPERTY' ||
      typeof parsed.publicId !== 'string' ||
      !isAllowedReturnPath(parsed.returnPath) ||
      typeof parsed.expiresAt !== 'number' ||
      parsed.expiresAt < Date.now()
    ) {
      clearSaveIntent();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearSaveIntent(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
