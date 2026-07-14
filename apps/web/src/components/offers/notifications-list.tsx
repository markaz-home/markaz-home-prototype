'use client';

import { Bell } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { Button, EmptyState } from '@markaz/ui';
import { Link } from '@/i18n/navigation';
import { trpc } from '@/trpc/react';

const KNOWN = new Set([
  'OFFER_RECEIVED',
  'OFFER_COUNTER_SELLER',
  'OFFER_COUNTER_BUYER',
  'OFFER_ACCEPTED',
  'OFFER_REJECTED',
  'OFFER_WITHDRAWN',
  'OFFER_CLOSED_OTHER',
  'OFFER_LISTING_UNAVAILABLE',
  'OFFER_EXPIRED',
]);

type Notification = {
  id: string;
  kind: string;
  threadId: string | null;
  read: boolean;
  createdAt: string;
};

/**
 * Full account notifications surface (offers-design-spec §30). Reads ONLY the
 * caller's own notifications through the authorised tRPC procedure; opening or
 * "mark all" only ever writes the caller's own `read_at` (recipient-scoped in the
 * API + RLS). Reuses the `offers.notify.*` copy so EN/AR parity is preserved.
 */
export function NotificationsList() {
  const t = useTranslations('offers.notify');
  const format = useFormatter();
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

  function label(kind: string): string {
    return KNOWN.has(kind) ? t(kind as 'OFFER_RECEIVED') : t('view');
  }

  function Row({ n }: { n: Notification }) {
    const when = format.dateTime(new Date(n.createdAt), { dateStyle: 'medium', timeStyle: 'short' });
    const body = (
      <span className="flex items-start gap-3">
        <span
          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? 'bg-transparent' : 'bg-primary'}`}
          aria-hidden
        />
        <span className="flex flex-col gap-0.5">
          <span dir="auto" className={n.read ? 'text-muted-foreground' : 'font-medium'}>
            {label(n.kind)}
          </span>
          <time dateTime={n.createdAt} dir="ltr" className="text-xs text-muted-foreground">
            {when}
          </time>
        </span>
      </span>
    );
    const className = `block rounded-lg border p-4 transition-colors ${
      n.read ? 'bg-card' : 'border-primary/30 bg-primary/5'
    }`;
    // Actionable notifications link into the authorised thread and clear their own unread flag.
    if (n.threadId) {
      return (
        <li>
          <Link
            href={`/offers/${n.threadId}`}
            className={`${className} hover:bg-accent`}
            onClick={() => {
              if (!n.read) markRead.mutate({ id: n.id }, { onSuccess: refresh });
            }}
          >
            {body}
          </Link>
        </li>
      );
    }
    return (
      <li>
        <div className={className}>{body}</div>
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
            <li key={i} className="h-16 animate-pulse rounded-lg border bg-muted/40" />
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
