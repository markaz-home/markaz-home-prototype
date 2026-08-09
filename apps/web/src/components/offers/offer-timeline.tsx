'use client';

import { useLocale, useTranslations } from 'next-intl';
import { formatAed, formatDateTime } from '@/lib/format';

interface TimelineEvent {
  id: string;
  type: string;
  actorSide: 'BUYER' | 'SELLER' | null;
  amountAed: number | null;
  createdAt: string;
}

/**
 * Structured negotiation timeline (offers-design-spec §20). A semantic ordered
 * list — never chat bubbles. Buyer/seller/system are distinguished by text and a
 * marker, never colour alone (§36.6). Oldest → newest.
 */
export function OfferTimeline({
  events,
  perspective,
  buyerLabel,
}: {
  events: TimelineEvent[];
  perspective: 'BUYER' | 'SELLER';
  buyerLabel: string | null;
}) {
  const t = useTranslations('offers.thread');
  const locale = useLocale();
  const buyer = buyerLabel ? t('buyerNumber', { n: buyerLabel }) : t('buyerGeneric');

  function copyFor(e: TimelineEvent): string {
    const amount = e.amountAed != null ? formatAed(e.amountAed, locale) : '';
    const youAreBuyer = perspective === 'BUYER';
    switch (e.type) {
      case 'OFFER_SUBMITTED':
        return youAreBuyer ? t('youSubmitted', { amount }) : t('buyerSubmitted', { buyer, amount });
      case 'BUYER_COUNTERED':
        return youAreBuyer ? t('youProposed', { amount }) : t('buyerProposed', { buyer, amount });
      case 'SELLER_COUNTERED':
        return perspective === 'SELLER'
          ? t('youProposed', { amount })
          : t('sellerProposed', { amount });
      case 'OFFER_ACCEPTED':
        return t('acceptedEvent');
      case 'OFFER_REJECTED':
        return t('declinedEvent');
      case 'OFFER_WITHDRAWN':
        return t('withdrewEvent');
      case 'OFFER_EXPIRED':
        return t('expiredEvent');
      case 'OFFER_VIEWED':
        return t('viewed');
      case 'LISTING_PAUSED':
        return t('pausedEvent');
      case 'LISTING_UNAVAILABLE':
        return t('unavailableEvent');
      case 'OTHER_OFFER_ACCEPTED':
        return t('otherAcceptedEvent');
      default:
        return '';
    }
  }

  // Filled = seller, ringed = buyer, faint = system. Shape carries the meaning,
  // never colour alone (§36.6).
  function markerClass(e: TimelineEvent): string {
    if (e.actorSide === 'SELLER') return 'bg-primary border-primary';
    if (e.actorSide === 'BUYER') return 'bg-background border-primary';
    return 'bg-muted-foreground/40 border-muted-foreground/40';
  }

  if (events.length === 0) return null;

  return (
    <ol className="mt-4">
      {events.map((e, index) => (
        <li key={e.id} className="relative grid grid-cols-[0.75rem_1fr] gap-4 pb-6 last:pb-0">
          {/* One continuous rail joins marker centre to marker centre; row
              spacing is padding, so it cannot break the visual connection. */}
          {index < events.length - 1 ? (
            <span
              className="bg-border absolute start-[0.3125rem] top-2 h-[calc(100%-0.125rem)] w-px"
              aria-hidden
            />
          ) : null}
          <span
            className={`relative z-10 mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full border-2 ${markerClass(e)}`}
            aria-hidden
          />
          <div className="min-w-0">
            <p className="text-sm" dir="auto">
              {copyFor(e)}
            </p>
            <time dateTime={e.createdAt} className="text-muted-foreground mt-0.5 block text-xs">
              {formatDateTime(e.createdAt, locale)}
            </time>
          </div>
        </li>
      ))}
    </ol>
  );
}
