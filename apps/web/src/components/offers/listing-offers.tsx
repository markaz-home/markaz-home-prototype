'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Alert, Button, Card, CardContent, EmptyState, ErrorState, Skeleton } from '@markaz/ui';
import { Link } from '@/i18n/navigation';
import { trpc } from '@/trpc/react';
import { formatAed, formatPct } from '@/lib/format';
import { OfferStatusBadge } from './shared';

/** Listing-specific seller offer management (offers-design-spec §18). Owner-only;
 * shows the seller-private threshold, comparison rows, and a no-ranking note. */
export function ListingOffers({ listingId }: { listingId: string }) {
  const t = useTranslations('offers');
  const tl = useTranslations('offers.listingView');
  const tt = useTranslations('offers.threshold');
  const locale = useLocale();
  const q = trpc.offers.getListingOffers.useQuery({ listingId });

  if (q.isLoading)
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  if (q.isError || !q.data)
    return (
      <ErrorState title={t('error.notAvailableTitle')} description={t('error.notAvailableBody')} />
    );

  const { listing, threads } = q.data;
  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb" className="text-muted-foreground text-sm">
        <Link href="/sell" className="hover:text-foreground">
          {listing.headline}
        </Link>
      </nav>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center">
          {listing.coverUrl ? (
            <img
              src={listing.coverUrl}
              alt=""
              className="h-24 w-36 shrink-0 rounded-md object-cover"
            />
          ) : null}
          <div className="flex-1">
            <h1 className="text-xl font-semibold" dir="auto">
              {listing.headline}
            </h1>
            <p className="text-muted-foreground text-sm">
              {t('askingPrice')}: <span dir="ltr">{formatAed(listing.askingPriceAed, locale)}</span>
            </p>
            <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <Stat
                label={tl('threshold')}
                value={formatAed(listing.notificationThresholdAed, locale)}
              />
              <Stat label={tl('activeOffers')} value={String(listing.activeCount)} />
              <Stat
                label={tl('highestOffer')}
                value={
                  listing.highestProposalAed != null
                    ? formatAed(listing.highestProposalAed, locale)
                    : '—'
                }
              />
              <Stat label={tl('responsesNeeded')} value={String(listing.actionNeeded)} />
            </dl>
          </div>
          <div className="flex shrink-0 flex-col gap-2">
            {listing.publicId ? (
              <Button asChild variant="outline" size="sm">
                <Link href={`/properties/${listing.publicId}/${listing.slug ?? ''}`}>
                  {tl('publicLink')}
                </Link>
              </Button>
            ) : null}
            <Button asChild variant="ghost" size="sm">
              <Link href={`/sell/listings/${listingId}/manage`}>{tl('manageLink')}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {threads.length > 1 ? (
        <Alert variant="info">
          <p className="text-sm">{tl('multipleNote')}</p>
        </Alert>
      ) : null}

      {threads.length === 0 ? (
        <EmptyState title={tl('noneTitle')} description={tl('noneBody')} />
      ) : (
        <ul className="space-y-3">
          {threads.map((th) => (
            <li key={th.threadId}>
              <Card>
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <OfferStatusBadge statusKey={th.statusKey} />
                      <span className="text-sm font-medium">
                        {t('buyerLabel', { n: th.buyerLabel })}
                      </span>
                      <span className="text-muted-foreground text-xs">{t('verifiedCustomer')}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-baseline gap-x-3 text-sm">
                      {th.currentProposal ? (
                        <span className="font-semibold tabular-nums" dir="ltr">
                          {formatAed(th.currentProposal.amountAed, locale)}
                        </span>
                      ) : null}
                      {th.comparison && th.comparison.direction !== 'EQUAL' ? (
                        <span className="text-muted-foreground" dir="ltr">
                          {th.comparison.direction === 'BELOW' ? '−' : '+'}
                          {formatPct(th.comparison.pct, locale)}
                        </span>
                      ) : null}
                      {th.threshold ? (
                        <span className="text-muted-foreground text-xs">
                          {th.threshold === 'AT_OR_ABOVE' ? tt('above') : tt('below')}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <Button asChild variant={th.isActionable ? 'default' : 'outline'}>
                    <Link href={`/offers/${th.threadId}`}>{t('reviewOffer')}</Link>
                  </Button>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium" dir="ltr">
        {value}
      </dd>
    </div>
  );
}
