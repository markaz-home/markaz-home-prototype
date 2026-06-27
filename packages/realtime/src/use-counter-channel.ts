'use client';
import { useEffect, useRef, useState } from 'react';
import { createSupabaseBrowserClient } from '@markaz/auth/browser';
import { REALTIME_TABLES, type CounterRow } from './channels';

type Status = 'connecting' | 'connected' | 'disconnected';

/**
 * Subscribes to postgres_changes on realtime_counters for a single counter id.
 * On every permitted server mutation the subscribed browsers receive the new
 * row without refreshing. Reconnection re-fetches the authoritative value so the
 * client reconciles with the server even after a dropped connection.
 */
export function useCounterChannel(counterId: string, onChange?: (row: CounterRow) => void) {
  const [value, setValue] = useState<number | null>(null);
  const [status, setStatus] = useState<Status>('connecting');
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let active = true;

    async function syncAuthoritative() {
      const { data } = await supabase
        .from(REALTIME_TABLES.counters)
        .select('id,value,updated_at')
        .eq('id', counterId)
        .maybeSingle();
      if (active && data) {
        setValue((data as CounterRow).value);
        onChangeRef.current?.(data as CounterRow);
      }
    }

    void syncAuthoritative();

    const channel = supabase
      .channel(`counter:${counterId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: REALTIME_TABLES.counters,
          filter: `id=eq.${counterId}`,
        },
        (payload) => {
          const row = payload.new as CounterRow;
          if (active && row) {
            setValue(row.value);
            onChangeRef.current?.(row);
          }
        },
      )
      .subscribe((s) => {
        if (!active) return;
        if (s === 'SUBSCRIBED') {
          setStatus('connected');
          // Reconcile after (re)connect.
          void syncAuthoritative();
        } else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') {
          setStatus('disconnected');
        }
      });

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [counterId]);

  return { value, status };
}
