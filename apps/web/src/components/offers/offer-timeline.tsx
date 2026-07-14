'use client';

import { useLocale, useTranslations } from 'next-intl';
import { formatAed } from '@/lib/format';

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
  const buyer = buyerLabel ? `Buyer ${buyerLabel}` : 'Buyer';

  function copyFor(e: TimelineEvent): string {
    const amount = e.amountAed != null ? formatAed(e.amountAed, locale) : '';
    const youAreBuyer = perspective === 'BUYER';
    switch (e.type) {
      case 'OFFER_SUBMITTED':
        return youAreBuyer ? t('youSubmitted', { amount }) : t('buyerSubmitted', { buyer, amount });
      case 'BUYER_COUNTERED':
        return youAreBuyer ? t('youProposed', { amount }) : t('buyerProposed', { buyer, amount });
      case 'SELLER_COUNTERED':
        return perspective === 'SELLER' ? t('youProposed', { amount }) : t('sellerProposed', { amount });
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

  function markerClass(e: TimelineEvent): string {
    if (e.actorSide === 'SELLER') return 'bg-brand-900'; // deep-blue filled (seller)
    if (e.actorSide === 'BUYER') return 'border-2 border-primary bg-background'; // outlined (buyer)
    return 'bg-muted-foreground/40'; // neutral (system)
  }

  if (events.length === 0) return null;

  return (
    <ol className="mt-3 space-y-4 border-s ps-6">
      {events.map((e) => (
        <li key={e.id} className="relative">
          <span className={`absolute -start-[1.7rem] mt-1 h-3 w-3 rounded-full ${markerClass(e)}`} aria-hidden />
          <p className="text-sm" dir="auto">{copyFor(e)}</p>
          <time dateTime={e.createdAt} className="text-xs text-muted-foreground" dir="ltr">
            {new Date(e.createdAt).toLocaleString(locale)}
          </time>
        </li>
      ))}
    </ol>
  );
}
