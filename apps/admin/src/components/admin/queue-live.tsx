'use client';
import { useTranslations } from 'next-intl';
import { RefreshCw, WifiOff } from 'lucide-react';
import { useAdminQueueChannel } from '@markaz/realtime';
import { useRouter } from '@/i18n/navigation';

/**
 * Live operational queues (spec §33). Subscribes to publication-request + transaction
 * changes and re-fetches authoritative dashboard metrics via a server-component refresh
 * — the payload is never trusted. The connection indicator is hidden while healthy and
 * only appears when reconnecting/stale (§37 Realtime Queue Indicator).
 */
export function QueueLive() {
  const t = useTranslations('admin');
  const router = useRouter();
  const { status } = useAdminQueueChannel(() => router.refresh());

  if (status === 'connected' || status === 'connecting') return null;

  return (
    <div
      role="status"
      className="inline-flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-900"
    >
      <WifiOff className="h-3.5 w-3.5" aria-hidden />
      {status === 'stale' ? t('realtime.stale') : t('realtime.reconnecting')}
      <button type="button" onClick={() => router.refresh()} className="inline-flex items-center gap-1 font-medium underline">
        <RefreshCw className="h-3 w-3" aria-hidden />
        {t('realtime.refresh')}
      </button>
    </div>
  );
}
