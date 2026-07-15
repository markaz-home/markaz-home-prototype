'use client';
import { useEffect, useRef, useState } from 'react';
import { createSupabaseBrowserClient } from '@markaz/auth/browser';
import { REALTIME_TABLES, type OfferEventRow } from './channels';

export type OfferChannelStatus = 'connecting' | 'connected' | 'reconnecting' | 'stale';

/**
 * Subscribes to offer_events for one thread (offers-design-spec §29). Realtime is
 * an ENHANCEMENT, never the correctness boundary: on any event we call `onChange`
 * so the consumer REFETCHES authoritative state via tRPC, rather than applying the
 * payload. RLS scopes delivery to participants; anonymous users receive nothing.
 *
 * Reconnect → `connected` again so the consumer can refetch and reconcile.
 * A dropped connection surfaces as `reconnecting` then `stale` for the §29.3 banner.
 */
export function useOfferThreadChannel(threadId: string, onChange?: () => void) {
  const [status, setStatus] = useState<OfferChannelStatus>('connecting');
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!threadId) return;
    const supabase = createSupabaseBrowserClient();
    let active = true;
    let staleTimer: ReturnType<typeof setTimeout> | null = null;

    const channel = supabase
      .channel(`offer-thread:${threadId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: REALTIME_TABLES.offerEvents,
          filter: `thread_id=eq.${threadId}`,
        },
        (payload) => {
          const row = payload.new as OfferEventRow;
          if (active && row) onChangeRef.current?.();
        },
      )
      .subscribe((s) => {
        if (!active) return;
        if (s === 'SUBSCRIBED') {
          if (staleTimer) clearTimeout(staleTimer);
          setStatus('connected');
          // Reconcile authoritative state after (re)connect.
          onChangeRef.current?.();
        } else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') {
          setStatus('reconnecting');
          // If we don't recover quickly, surface the "updates may be delayed" banner.
          if (staleTimer) clearTimeout(staleTimer);
          staleTimer = setTimeout(() => active && setStatus('stale'), 8000);
        }
      });

    return () => {
      active = false;
      if (staleTimer) clearTimeout(staleTimer);
      void supabase.removeChannel(channel);
    };
  }, [threadId]);

  return { status };
}
