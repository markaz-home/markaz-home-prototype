'use client';

import { useEffect } from 'react';
import { readSaveIntent } from '@/lib/save-intent';

/**
 * After authentication, a signed-in visitor lands in the app shell. If a pending
 * "save property" intent exists (design spec §28), send them back to the property
 * page where the save completes idempotently. Runs once on mount; the property
 * page consumes the intent. Uses a hard navigation so the public route renders
 * with a fresh authenticated session.
 */
export function SaveIntentRedirect() {
  useEffect(() => {
    const intent = readSaveIntent();
    if (intent && typeof window !== 'undefined' && window.location.pathname !== intent.returnPath) {
      window.location.assign(intent.returnPath);
    }
  }, []);
  return null;
}
