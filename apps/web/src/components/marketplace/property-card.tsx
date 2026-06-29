'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Bath, BedDouble, Maximize } from 'lucide-react';
import { Badge, Card, cn } from '@markaz/ui';
import { Link } from '@/i18n/navigation';
import { formatAed, formatNumber } from '@/lib/format';
import { SaveButton } from './save-button';
import type { RouterOutputs } from '@/trpc/types';

export type MarketplaceCard = RouterOutputs['marketplace']['search']['items'][number];

interface PropertyCardProps {
  card: MarketplaceCard;
  isAuthenticated: boolean;
  saved?: boolean;
  owned?: boolean;
}

/** Marketplace result card (design spec §23). Whole card links to the public
 * detail page; the Save control sits above it without nesting interactions. */
export function PropertyCard({ card, isAuthenticated, saved, owned }: PropertyCardProps) {
  const t = useTranslations('property');
  const tf = useTranslations('filters');
  const locale = useLocale();
  const href = `/properties/${card.publicId}/${card.slug ?? ''}`;
  const returnPath = `/${locale}/properties/${card.publicId}/${card.slug ?? ''}`;
  const beds =
    card.bedrooms === 0 ? t('bedsStudio') : card.bedrooms != null ? t('beds', { count: card.bedrooms }) : null;

  return (
    <Card className="group relative flex flex-col overflow-hidden">
      {/* Save / owner control — rendered above the link, not inside it. */}
      <div className="absolute end-3 top-3 z-10">
        {owned ? (
          <Badge variant="outline" className="bg-background">{t('yourListing')}</Badge>
        ) : (
          <SaveButton
            publicId={card.publicId ?? ''}
            isAuthenticated={isAuthenticated}
            returnPath={returnPath}
            initialSaved={saved}
          />
        )}
      </div>

      <Link href={href} className="flex flex-1 flex-col focus:outline-none">
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
          {card.coverUrl ? (
            <img
              src={card.coverUrl}
              alt={card.headline}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
              {t('imageUnavailable')}
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-2 p-4">
          <p className="text-lg font-semibold">{formatAed(card.askingPriceAed, locale)}</p>
          <p className="line-clamp-2 text-sm font-medium text-foreground">{card.headline}</p>
          <p className="text-sm text-muted-foreground">
            {[card.community, card.emirate ? tf(`emirate${card.emirate}` as 'emirateDUBAI') : null]
              .filter(Boolean)
              .join(' · ')}
          </p>

          <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-2 text-sm text-muted-foreground">
            {beds && (
              <span className="inline-flex items-center gap-1">
                <BedDouble className="h-4 w-4" aria-hidden /> {beds}
              </span>
            )}
            {card.bathrooms != null && (
              <span className="inline-flex items-center gap-1">
                <Bath className="h-4 w-4" aria-hidden /> {t('baths', { count: card.bathrooms })}
              </span>
            )}
            {card.sizeSqft != null && (
              <span className="inline-flex items-center gap-1">
                <Maximize className="h-4 w-4" aria-hidden />{' '}
                {t('sqft', { size: formatNumber(card.sizeSqft, locale) })}
              </span>
            )}
          </div>

          {card.investmentCaseAvailable && (
            <Badge variant="outline" className={cn('mt-1 w-fit')}>
              {t('investmentAvailable')}
            </Badge>
          )}
        </div>
      </Link>
    </Card>
  );
}
