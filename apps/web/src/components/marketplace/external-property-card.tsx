'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Bath, BedDouble, ExternalLink, Maximize } from 'lucide-react';
import { Badge, Card } from '@markaz/ui';
import { formatAed, formatNumber } from '@/lib/format';
import type { ExternalBrowseCard } from './external-browse';

export function ExternalPropertyCard({ card }: { card: ExternalBrowseCard }) {
  const locale = useLocale();
  const t = useTranslations('property');
  const landingT = useTranslations('landing');
  const filterT = useTranslations('filters');
  const beds =
    card.bedrooms === 0
      ? t('bedsStudio')
      : card.bedrooms !== null
        ? t('beds', { count: card.bedrooms })
        : null;
  const typeLabel =
    card.category === 'APARTMENT'
      ? filterT('typeApartment')
      : card.category === 'VILLA'
        ? filterT('typeVilla')
        : card.propertyType;

  return (
    <Card className="group flex overflow-hidden">
      <a
        href={card.externalUrl}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="flex min-w-0 flex-1 flex-col focus:outline-none"
      >
        <div className="bg-muted relative aspect-[4/3] w-full overflow-hidden">
          {card.coverUrl ? (
            // The server projection restricts external image hosts; loading the source
            // directly avoids copying third-party listing images into MARKAZ storage.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={card.coverUrl}
              alt={card.title}
              loading="lazy"
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
            />
          ) : (
            <div className="text-muted-foreground flex h-full items-center justify-center p-4 text-center text-sm">
              {t('imageUnavailable')}
            </div>
          )}
          <Badge className="bg-background/95 text-foreground absolute start-3 top-3 shadow-none">
            {landingT('featuredSourceBayut')}
          </Badge>
        </div>

        <div className="flex flex-1 flex-col gap-2 p-4">
          <p className="text-lg font-semibold">{formatAed(card.askingPriceAed, locale)}</p>
          <p className="text-foreground line-clamp-2 text-sm font-medium">{card.title}</p>
          <p className="text-muted-foreground text-sm">
            {[card.community, card.emirate].filter(Boolean).join(' · ')}
          </p>
          {typeLabel && (
            <Badge variant="outline" className="w-fit">
              {typeLabel}
            </Badge>
          )}

          <div className="text-muted-foreground mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-2 text-sm">
            {beds && (
              <span className="inline-flex items-center gap-1">
                <BedDouble className="h-4 w-4" aria-hidden /> {beds}
              </span>
            )}
            {card.bathrooms !== null && (
              <span className="inline-flex items-center gap-1">
                <Bath className="h-4 w-4" aria-hidden />
                {t('baths', { count: card.bathrooms })}
              </span>
            )}
            {card.sizeSqft !== null && (
              <span className="inline-flex items-center gap-1">
                <Maximize className="h-4 w-4" aria-hidden />
                {t('sqft', { size: formatNumber(card.sizeSqft, locale) })}
              </span>
            )}
          </div>

          <span className="text-primary mt-2 inline-flex items-center gap-1 text-sm font-medium">
            {landingT('featuredOpenExternal')}
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </span>
        </div>
      </a>
    </Card>
  );
}
