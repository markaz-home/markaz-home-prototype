'use client';
import { useEffect, useRef, useState } from 'react';
import { createSupabaseBrowserClient } from '@markaz/auth/browser';
import { REALTIME_TABLES } from './channels';

export type AdminQueueStatus = 'connecting' | 'connected' | 'reconnecting' | 'stale';

/**
 * Week-6 admin operational queues (admin-portal-design-spec §33). Subscribes to the
 * publication-request and transaction tables so the dashboard's "needs attention"
 * queues stay live. Realtime is an ENHANCEMENT, never the correctness boundary: on
 * any relevant change we call `onChange` so the consumer REFETCHES authoritative
 * metrics (here, a server-component refresh) rather than trusting the payload.
 * Delivery is scoped by admin RLS; non-admins receive nothing. Events are coalesced
 * so a burst of changes triggers a single refetch.
 */
export function useAdminQueueChannel(onChange?: () => void) {
  const [status, setStatus] = useState<AdminQueueStatus>('connecting');
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let active = true;
    let staleTimer: ReturnType<typeof setTimeout> | null = null;
    let coalesce: ReturnType<typeof setTimeout> | null = null;

    const bump = () => {
      if (!active) return;
      if (coalesce) clearTimeout(coalesce);
      coalesce = setTimeout(() => active && onChangeRef.current?.(), 400);
    };

    const channel = supabase
      .channel('admin-queues')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: REALTIME_TABLES.publicationRequests },
        bump,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: REALTIME_TABLES.transactions },
        bump,
      )
      .subscribe((s) => {
        if (!active) return;
        if (s === 'SUBSCRIBED') {
          if (staleTimer) clearTimeout(staleTimer);
          setStatus('connected');
        } else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') {
          setStatus('reconnecting');
          if (staleTimer) clearTimeout(staleTimer);
          staleTimer = setTimeout(() => active && setStatus('stale'), 8000);
        }
      });

    return () => {
      active = false;
      if (staleTimer) clearTimeout(staleTimer);
      if (coalesce) clearTimeout(coalesce);
      void supabase.removeChannel(channel);
    };
  }, []);

  return { status };
}
