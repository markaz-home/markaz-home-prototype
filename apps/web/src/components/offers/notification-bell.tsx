'use client';

import { Bell } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useNotificationChannel } from '@markaz/realtime';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@markaz/ui';
import { useRouter } from '@/i18n/navigation';
import { trpc } from '@/trpc/react';
import {
  NotificationContent,
  notificationHref,
  type NotificationItem,
} from '@/components/notifications/notification-content';

/** Header notification bell with unread count + compact, event-specific context. */
export function NotificationBell() {
  const t = useTranslations('offers.notify');
  const router = useRouter();
  const utils = trpc.useUtils();
  const counts = trpc.offers.getUnreadCounts.useQuery(undefined, { refetchInterval: 60_000 });
  const list = trpc.offers.notifications.useQuery({ limit: 12 }, { refetchInterval: 60_000 });
  const markRead = trpc.offers.markNotificationRead.useMutation();
  const markAll = trpc.offers.markAllNotificationsRead.useMutation();
  const unread = counts.data?.unread ?? 0;

  const refresh = () => {
    void utils.offers.getUnreadCounts.invalidate();
    void utils.offers.notifications.invalidate();
  };
  useNotificationChannel(refresh);

  function open(n: NotificationItem) {
    router.push(notificationHref(n));
    if (!n.read) markRead.mutate({ id: n.id }, { onSettled: refresh });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={`${t('title')}${unread > 0 ? ` (${unread})` : ''}`}
        >
          <Bell className="h-5 w-5" aria-hidden />
          {unread > 0 ? (
            <span className="bg-primary text-primary-foreground absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold">
              {unread > 99 ? '99+' : unread}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[min(25rem,calc(100vw-1.5rem))] p-0">
        <div className="flex items-center justify-between">
          <DropdownMenuLabel>{t('title')}</DropdownMenuLabel>
          {unread > 0 ? (
            <button
              type="button"
              className="text-primary me-4 text-xs underline"
              onClick={async () => {
                await markAll.mutateAsync().catch(() => {});
                refresh();
              }}
            >
              {t('markAllRead')}
            </button>
          ) : null}
        </div>
        <DropdownMenuSeparator />
        {!list.data || list.data.length === 0 ? (
          <p className="text-muted-foreground px-4 py-8 text-center text-sm">{t('empty')}</p>
        ) : (
          list.data.map((n) => (
            <DropdownMenuItem
              key={n.id}
              onSelect={() => open(n)}
              className="border-border/60 block cursor-pointer border-b px-4 py-3 last:border-b-0"
            >
              <NotificationContent notification={n} compact />
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator className="m-0" />
        <button
          type="button"
          className="text-primary hover:bg-foreground/5 w-full px-4 py-3 text-center text-sm font-medium"
          onClick={() => router.push('/account/notifications')}
        >
          {t('viewAll')}
        </button>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Small action-needed badge for the Offers nav entry. */
export function OffersNavBadge() {
  const counts = trpc.offers.getUnreadCounts.useQuery(undefined, { refetchInterval: 60_000 });
  const n = counts.data?.actionNeeded ?? 0;
  if (n <= 0) return null;
  return (
    <span
      className="bg-primary text-primary-foreground ms-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold"
      aria-hidden
    >
      {n > 99 ? '99+' : n}
    </span>
  );
}
