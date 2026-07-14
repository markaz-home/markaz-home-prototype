'use client';
import { useEffect, useRef, useState } from 'react';
import { createSupabaseBrowserClient } from '@markaz/auth/browser';
import { REALTIME_TABLES, type TransactionEventRow } from './channels';

export type TransactionChannelStatus = 'connecting' | 'connected' | 'reconnecting' | 'stale';

/**
 * Subscribes to transaction_events for one transaction (transaction-tracker-design-spec §35).
 * Realtime is an ENHANCEMENT, never the correctness boundary: on any event we call
 * `onChange` so the consumer REFETCHES authoritative state via tRPC. RLS scopes delivery
 * to the two participants; anonymous users receive nothing. Reconnect reconciles.
 */
export function useTransactionChannel(transactionId: string, onChange?: () => void) {
  const [status, setStatus] = useState<TransactionChannelStatus>('connecting');
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!transactionId) return;
    const supabase = createSupabaseBrowserClient();
    let active = true;
    let staleTimer: ReturnType<typeof setTimeout> | null = null;

    const channel = supabase
      .channel(`transaction:${transactionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: REALTIME_TABLES.transactionEvents,
          filter: `transaction_id=eq.${transactionId}`,
        },
        (payload) => {
          const row = payload.new as TransactionEventRow;
          if (active && row) onChangeRef.current?.();
        },
      )
      .subscribe((s) => {
        if (!active) return;
        if (s === 'SUBSCRIBED') {
          if (staleTimer) clearTimeout(staleTimer);
          setStatus('connected');
          onChangeRef.current?.();
        } else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') {
          setStatus('reconnecting');
          if (staleTimer) clearTimeout(staleTimer);
          staleTimer = setTimeout(() => active && setStatus('stale'), 8000);
        }
      });

    return () => {
      active = false;
      if (staleTimer) clearTimeout(staleTimer);
      void supabase.removeChannel(channel);
    };
  }, [transactionId]);

  return { status };
}
