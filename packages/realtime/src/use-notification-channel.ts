'use client';

import { useEffect, useRef } from 'react';
import { createSupabaseBrowserClient } from '@markaz/auth/browser';
import { REALTIME_TABLES, type NotificationRow } from './channels';

/** Refetches the authoritative recipient-scoped notification list on inserts or
 * read-state updates. RLS prevents a customer from receiving another user's rows. */
export function useNotificationChannel(onChange?: () => void) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let active = true;
    let coalesce: ReturnType<typeof setTimeout> | null = null;
    const changed = (payload: { new: unknown }) => {
      const row = payload.new as NotificationRow;
      if (!active || !row) return;
      if (coalesce) clearTimeout(coalesce);
      coalesce = setTimeout(() => active && onChangeRef.current?.(), 250);
    };
    const channel = supabase
      .channel('customer-notifications')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: REALTIME_TABLES.notifications },
        changed,
      )
      .subscribe((status) => {
        if (active && status === 'SUBSCRIBED') onChangeRef.current?.();
      });
    return () => {
      active = false;
      if (coalesce) clearTimeout(coalesce);
      void supabase.removeChannel(channel);
    };
  }, []);
}
