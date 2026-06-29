'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { trpc } from '@/trpc/react';
import type { AutosaveState } from './wizard';

export interface DraftPayload {
  property?: {
    propertyType?: string | null;
    community?: string | null;
    buildingOrProject?: string | null;
    unitIdentifier?: string | null;
    bedrooms?: number | null;
    bathrooms?: number | null;
    sizeSqft?: number | null;
    furnishingStatus?: string | null;
    occupancyStatus?: string | null;
    completionStatus?: string | null;
    parkingSpaces?: number | null;
    features?: string[] | null;
  };
  description?: string | null;
  askingPriceAed?: number | null;
  minNotificationPriceAed?: number | null;
}

/**
 * Debounced autosave for editable wizard form steps (design spec §22). Persists
 * partial changes 800ms after the last edit (and on navigate/unmount). Tracks the
 * listing `version` for optimistic concurrency — a CONFLICT (another tab saved)
 * surfaces as an error state. `'conflict'` is mapped to the error indicator.
 */
export function useAutosave(listingId: string, initialVersion: number) {
  const [state, setState] = useState<AutosaveState>('idle');
  const versionRef = useRef(initialVersion);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<DraftPayload | null>(null);
  const save = trpc.listing.saveDraft.useMutation();
  // Hold the latest mutation in a ref so the callbacks below keep a STABLE
  // identity across renders (the mutation object itself changes every render).
  const saveRef = useRef(save);
  saveRef.current = save;

  const flush = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const payload = pending.current;
    if (!payload) return;
    pending.current = null;
    setState('saving');
    try {
      const res = await saveRef.current.mutateAsync({ listingId, version: versionRef.current, ...payload });
      versionRef.current = res.version;
      setState('saved');
    } catch {
      setState('error');
    }
  }, [listingId]);

  const schedule = useCallback(
    (payload: DraftPayload) => {
      pending.current = payload;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        void flush();
      }, 800);
    },
    [flush],
  );

  /** Drop any pending autosave without sending (used right before an explicit save). */
  const cancel = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    pending.current = null;
  }, []);

  // Flush a pending change on unmount (navigating away).
  useEffect(
    () => () => {
      void flush();
    },
    [flush],
  );

  return { state, schedule, flush, cancel };
}
