/* eslint-disable @next/next/no-img-element -- Notification thumbnails are runtime public Storage URLs. */
'use client';

import { useLocale, useTranslations } from 'next-intl';
import {
  AlertTriangle,
  ArrowLeftRight,
  CheckCircle2,
  Clock3,
  Eye,
  HandCoins,
  Receipt,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import { cn } from '@markaz/ui';
import type { RouterOutputs } from '@/trpc/types';
import { formatAed } from '@/lib/format';

export type NotificationItem = RouterOutputs['offers']['notifications'][number];

export function notificationHref(n: NotificationItem): string {
  if (n.transactionId) return `/transactions/${n.transactionId}`;
  if (n.threadId) return `/offers/${n.threadId}`;
  if (n.listingId && n.kind.startsWith('LISTING_')) return `/sell/listings/${n.listingId}/manage`;
  if (n.kind.startsWith('ACCOUNT_')) return '/account/profile';
  return '/account/notifications';
}

function relativeTime(value: string, locale: string): string {
  const seconds = Math.round((new Date(value).getTime() - Date.now()) / 1000);
  const abs = Math.abs(seconds);
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (abs < 60) return formatter.format(seconds, 'second');
  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) return formatter.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return formatter.format(hours, 'hour');
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return formatter.format(days, 'day');
  const months = Math.round(days / 30);
  return formatter.format(months, 'month');
}

function NotificationIcon({ kind }: { kind: string }) {
  const className = 'h-4 w-4';
  if (kind === 'OFFER_RECEIVED') return <HandCoins className={className} aria-hidden />;
  if (kind === 'OFFER_VIEWED') return <Eye className={className} aria-hidden />;
  if (kind.includes('COUNTER')) return <ArrowLeftRight className={className} aria-hidden />;
  if (kind.includes('ACCEPTED') || kind.includes('COMPLETED'))
    return <CheckCircle2 className={className} aria-hidden />;
  if (kind.includes('REJECTED') || kind.includes('WITHDRAWN') || kind.includes('CANCELLED'))
    return <XCircle className={className} aria-hidden />;
  if (kind.includes('REMINDER')) return <Clock3 className={className} aria-hidden />;
  if (kind.startsWith('TRANSACTION_')) return <Receipt className={className} aria-hidden />;
  if (kind.startsWith('ACCOUNT_') || kind.startsWith('LISTING_'))
    return <ShieldAlert className={className} aria-hidden />;
  return <AlertTriangle className={className} aria-hidden />;
}

export function NotificationContent({
  notification: n,
  compact = false,
}: {
  notification: NotificationItem;
  compact?: boolean;
}) {
  const t = useTranslations('offers.notify');
  const locale = useLocale();
  const eyebrow = n.kind.startsWith('OFFER_')
    ? t('offerActivity')
    : n.kind.startsWith('TRANSACTION_')
      ? t('transactionActivity')
      : t('accountActivity');
  const title = t(n.kind as 'OFFER_RECEIVED');
  const property = n.property?.headline ?? t('propertyFallback');

  return (
    <span className={cn('flex min-w-0 items-start', compact ? 'gap-3' : 'gap-4')}>
      {!compact && n.property?.coverUrl ? (
        <img
          src={n.property.coverUrl}
          alt=""
          className="h-16 w-20 shrink-0 rounded-lg object-cover"
        />
      ) : (
        <span className="border-primary/30 bg-primary/10 text-primary grid h-9 w-9 shrink-0 place-items-center rounded-full border">
          <NotificationIcon kind={n.kind} />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="text-primary block text-[10px] font-semibold uppercase tracking-[0.12em]">
          {eyebrow}
        </span>
        <span
          dir="auto"
          className={cn(
            'mt-0.5 block leading-snug',
            n.read ? 'text-muted-foreground' : 'font-medium',
          )}
        >
          {title}
        </span>
        <span dir="auto" className="text-muted-foreground mt-1 block truncate text-xs">
          {property}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-x-2 text-xs">
          {n.amountAed != null ? (
            <span className="text-foreground font-medium" dir="ltr">
              {formatAed(n.amountAed, locale)}
            </span>
          ) : null}
          <time dateTime={n.createdAt} className="text-muted-foreground">
            {relativeTime(n.createdAt, locale)}
          </time>
        </span>
      </span>
      {!n.read ? (
        <span className="bg-primary mt-2 h-2 w-2 shrink-0 rounded-full" aria-hidden />
      ) : null}
    </span>
  );
}
