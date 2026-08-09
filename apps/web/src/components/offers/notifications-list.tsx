'use client';

import { Bell } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useNotificationChannel } from '@markaz/realtime';
import { Button, EmptyState } from '@markaz/ui';
import { Link } from '@/i18n/navigation';
import { trpc } from '@/trpc/react';
import {
  NotificationContent,
  notificationHref,
  type NotificationItem,
} from '@/components/notifications/notification-content';

/**
 * Full account notifications surface (offers-design-spec §30). Reads ONLY the
 * caller's own notifications through the authorised tRPC procedure; opening or
 * "mark all" only ever writes the caller's own `read_at` (recipient-scoped in the
 * API + RLS). Reuses the `offers.notify.*` copy so EN/AR parity is preserved.
 */
export function NotificationsList() {
  const t = useTranslations('offers.notify');
  const utils = trpc.useUtils();
  const list = trpc.offers.notifications.useQuery({ limit: 50 });
  const counts = trpc.offers.getUnreadCounts.useQuery();
  const markRead = trpc.offers.markNotificationRead.useMutation();
  const markAll = trpc.offers.markAllNotificationsRead.useMutation();
  const unread = counts.data?.unread ?? 0;

  function refresh() {
    void utils.offers.notifications.invalidate();
    void utils.offers.getUnreadCounts.invalidate();
  }
  useNotificationChannel(refresh);

  function Row({ n }: { n: NotificationItem }) {
    const className = `block rounded-lg border p-4 transition-colors ${
      n.read ? 'bg-card' : 'border-primary/30 bg-primary/5'
    }`;
    return (
      <li>
        <Link
          href={notificationHref(n)}
          className={`${className} hover:bg-accent`}
          onClick={() => {
            if (!n.read) markRead.mutate({ id: n.id }, { onSuccess: refresh });
          }}
        >
          <NotificationContent notification={n} />
        </Link>
      </li>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        {unread > 0 ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => markAll.mutate(undefined, { onSuccess: refresh })}
            disabled={markAll.isPending}
          >
            {t('markAllRead')}
          </Button>
        ) : null}
      </div>

      <p aria-live="polite" role="status" className="sr-only">
        {unread > 0 ? `${unread}` : ''}
      </p>

      {list.isLoading ? (
        <ul className="space-y-3" aria-hidden>
          {[0, 1, 2].map((i) => (
            <li key={i} className="bg-muted/40 h-16 animate-pulse rounded-lg border" />
          ))}
        </ul>
      ) : !list.data || list.data.length === 0 ? (
        <EmptyState icon={<Bell className="h-6 w-6" aria-hidden />} title={t('empty')} />
      ) : (
        <ul className="space-y-3">
          {list.data.map((n) => (
            <Row key={n.id} n={n} />
          ))}
        </ul>
      )}
    </div>
  );
}
