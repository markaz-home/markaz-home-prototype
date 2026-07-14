'use client';

import { useEffect } from 'react';
import { readOfferIntent } from '@/lib/offer-intent';
import { readSaveIntent } from '@/lib/save-intent';

/**
 * After authentication, a signed-in visitor lands in the app shell. If a pending
 * "make an offer" intent exists (offers-design-spec §12, §28) — and no save intent
 * takes precedence — send them back to the property's offer route, where
 * eligibility is re-checked server-side. Hard navigation so the public route
 * renders with a fresh authenticated session.
 */
export function OfferIntentRedirect() {
  useEffect(() => {
    if (readSaveIntent()) return; // save intent handled by its own redirect
    const intent = readOfferIntent();
    if (intent && typeof window !== 'undefined' && window.location.pathname !== intent.returnPath) {
      window.location.assign(intent.returnPath);
    }
  }, []);
  return null;
}
