/**
 * Anonymous "make an offer" interception (offers-design-spec §12, §28). When a
 * signed-out visitor taps Make an Offer we persist a SHORT-LIVED, client-only
 * intent (public listing id + readable return route + intent only — NEVER an
 * amount, §12.2), send them to sign-in, and once authenticated return them to the
 * property's offer route where eligibility is re-checked server-side.
 *
 * Stored in sessionStorage only: it never reaches the server, holds no
 * credentials/tokens/amounts, and the return route is allow-listed to the public
 * property/offer path (no open redirect, §37.2).
 */
const KEY = 'markaz.offerIntent';
const TTL_MS = 30 * 60 * 1000; // 30 minutes

export interface OfferIntent {
  action: 'MAKE_OFFER';
  publicId: string;
  returnPath: string;
  locale: string;
  expiresAt: number;
}

/** Only relative `/{locale}/properties/{publicId}[/...]` routes are allowed back. */
export function isAllowedOfferReturnPath(path: string): boolean {
  return /^\/(en|ar)\/properties\/[A-Za-z0-9-]+(\/[^?#\s]*)?$/.test(path);
}

export function storeOfferIntent(intent: Omit<OfferIntent, 'action' | 'expiresAt'>): void {
  if (typeof window === 'undefined') return;
  if (!isAllowedOfferReturnPath(intent.returnPath)) return;
  const payload: OfferIntent = { action: 'MAKE_OFFER', expiresAt: Date.now() + TTL_MS, ...intent };
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    /* storage unavailable — interception degrades to a plain sign-in */
  }
}

export function readOfferIntent(): OfferIntent | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OfferIntent;
    if (
      parsed.action !== 'MAKE_OFFER' ||
      typeof parsed.publicId !== 'string' ||
      !isAllowedOfferReturnPath(parsed.returnPath) ||
      typeof parsed.expiresAt !== 'number' ||
      parsed.expiresAt < Date.now()
    ) {
      clearOfferIntent();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearOfferIntent(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
