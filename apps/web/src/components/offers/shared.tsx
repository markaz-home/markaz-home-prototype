'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Alert, StatusBadge } from '@markaz/ui';
import { formatAed, formatPct } from '@/lib/format';

/** Extract the stable machine token a tRPC offer error carries in its message. */
export function offerErrorToken(err: unknown): string {
  const msg = (err as { message?: string } | null)?.message ?? '';
  const m = msg.match(/\b[A-Z_]{3,}\b/);
  return m ? m[0] : 'GENERIC';
}

/** Hook returning a localized message for an offer error token. */
export function useOfferErrorMessage() {
  const t = useTranslations('offers.error');
  return (err: unknown): string => {
    const token = offerErrorToken(err);
    // next-intl throws on a missing key; guard with the known set.
    const known = new Set([
      'INVALID_AMOUNT',
      'EQUAL_AMOUNT',
      'EXPIRED',
      'STALE',
      'ALREADY_ACCEPTED',
      'LISTING_UNAVAILABLE',
      'LISTING_CHANGED',
      'OWN_LISTING',
      'NOT_FOUND',
      'GENERIC',
    ]);
    return t(known.has(token) ? (token as 'GENERIC') : 'GENERIC');
  };
}

const STATUS_TONE: Record<string, 'neutral' | 'success' | 'warning' | 'primary'> = {
  draft: 'neutral',
  waitingSeller: 'neutral',
  waitingBuyer: 'neutral',
  responseNeeded: 'primary',
  accepted: 'success',
  rejected: 'neutral',
  withdrawn: 'neutral',
  expired: 'neutral',
  unavailable: 'neutral',
  otherAccepted: 'neutral',
};

/** Text-first status pill; colour is never the sole indicator (§36.6). */
export function OfferStatusBadge({ statusKey }: { statusKey: string }) {
  const t = useTranslations('offers.status');
  return (
    <StatusBadge tone={STATUS_TONE[statusKey] ?? 'neutral'}>
      {t(statusKey as 'accepted')}
    </StatusBadge>
  );
}

/** Non-binding disclosure — always plain text, never a tooltip (§32 / spec §15.2). */
export function NonBindingDisclosure({
  variant = 'nonBinding',
}: {
  variant?: 'nonBinding' | 'counter' | 'accept';
}) {
  const t = useTranslations('offers.disclosure');
  return (
    <Alert variant="info">
      <p className="text-sm">{t(variant)}</p>
    </Alert>
  );
}

/** Neutral asking-price comparison phrase, announced as one sentence (§13.5). */
export function AmountComparison({
  comparison,
}: {
  comparison: { absDiff: number; pct: number; direction: 'BELOW' | 'ABOVE' | 'EQUAL' } | null;
}) {
  const t = useTranslations('offers.form');
  const locale = useLocale();
  if (!comparison) return null;
  if (comparison.direction === 'EQUAL')
    return <p className="text-muted-foreground text-sm">{t('matches')}</p>;
  const amount = formatAed(comparison.absDiff, locale);
  const phrase =
    comparison.direction === 'BELOW' ? t('belowAsking', { amount }) : t('aboveAsking', { amount });
  return (
    <p className="text-muted-foreground text-sm">
      <span dir="ltr">{phrase}</span> · <span dir="ltr">{formatPct(comparison.pct, locale)}</span>
    </p>
  );
}

/** Non-blocking realtime connection banner with a manual refresh (§29.3). */
export function RealtimeBanner({
  status,
  onRefresh,
}: {
  status: 'connecting' | 'connected' | 'reconnecting' | 'stale';
  onRefresh: () => void;
}) {
  const t = useTranslations('offers.realtime');
  if (status === 'connected' || status === 'connecting') return null;
  return (
    <Alert variant="warning">
      <div className="flex items-center justify-between gap-3">
        <span>{status === 'stale' ? t('stale') : t('reconnecting')}</span>
        {status === 'stale' ? (
          <button type="button" onClick={onRefresh} className="font-medium underline">
            {t('refresh')}
          </button>
        ) : null}
      </div>
    </Alert>
  );
}
