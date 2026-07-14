'use client';

import { Bell } from 'lucide-react';
import { useTranslations } from 'next-intl';
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

/** Header notification bell with unread count + compact menu (offers-design-spec §30).
 * No amounts in the header menu — those appear after entering the authorised thread. */
export function NotificationBell() {
  const t = useTranslations('offers.notify');
  const router = useRouter();
  const utils = trpc.useUtils();
  const counts = trpc.offers.getUnreadCounts.useQuery(undefined, { refetchInterval: 60_000 });
  const list = trpc.offers.notifications.useQuery({ limit: 12 });
  const markRead = trpc.offers.markNotificationRead.useMutation();
  const markAll = trpc.offers.markAllNotificationsRead.useMutation();
  const unread = counts.data?.unread ?? 0;

  async function open(id: string, threadId: string | null) {
    await markRead.mutateAsync({ id }).catch(() => {});
    void utils.offers.getUnreadCounts.invalidate();
    void utils.offers.notifications.invalidate();
    if (threadId) router.push(`/offers/${threadId}`);
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
      <DropdownMenuContent className="w-80">
        <div className="flex items-center justify-between">
          <DropdownMenuLabel>{t('title')}</DropdownMenuLabel>
          {unread > 0 ? (
            <button
              type="button"
              className="text-primary me-2 text-xs underline"
              onClick={async () => {
                await markAll.mutateAsync().catch(() => {});
                void utils.offers.getUnreadCounts.invalidate();
                void utils.offers.notifications.invalidate();
              }}
            >
              {t('markAllRead')}
            </button>
          ) : null}
        </div>
        <DropdownMenuSeparator />
        {!list.data || list.data.length === 0 ? (
          <p className="text-muted-foreground px-2 py-6 text-center text-sm">{t('empty')}</p>
        ) : (
          list.data.map((n) => (
            <DropdownMenuItem
              key={n.id}
              onSelect={() => void open(n.id, n.threadId)}
              className={n.read ? 'opacity-70' : 'font-medium'}
            >
              <span className="flex items-center gap-2">
                {!n.read ? (
                  <span className="bg-primary h-2 w-2 shrink-0 rounded-full" aria-hidden />
                ) : null}
                {KNOWN.has(n.kind) ? t(n.kind as 'OFFER_RECEIVED') : t('view')}
              </span>
            </DropdownMenuItem>
          ))
        )}
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
