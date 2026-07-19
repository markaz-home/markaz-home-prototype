'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Bath, BedDouble, ExternalLink, Maximize } from 'lucide-react';
import { Badge, Button, Card, Skeleton } from '@markaz/ui';
import { Link } from '@/i18n/navigation';
import { formatAed, formatNumber } from '@/lib/format';
import { trpc } from '@/trpc/react';

interface FeaturedCard {
  kind: 'internal' | 'external';
  id: string;
  href: string;
  title: string;
  propertyType: string | null;
  askingPriceAed: number | null;
  emirate: string | null;
  community: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  sizeSqft: number | null;
  coverUrl: string | null;
}

const MAX_CARDS = 6;
const MAX_INTERNAL_CARDS = 3;

export function FeaturedProperties() {
  const locale = useLocale();
  const t = useTranslations('landing');
  const propertyT = useTranslations('property');
  const filterT = useTranslations('filters');
  const apiLocale = locale === 'ar' ? 'ar' : 'en';
  const internal = trpc.marketplace.featured.useQuery(undefined, { staleTime: 60_000 });
  const external = trpc.externalProperties.featured.useQuery(
    { locale: apiLocale, limit: MAX_CARDS },
    { staleTime: 60 * 60 * 1_000 },
  );

  const internalCards = (internal.data ?? [])
    .flatMap<FeaturedCard>((card) => {
      if (!card.publicId) return [];
      return [
        {
          kind: 'internal',
          id: card.publicId,
          href: `/properties/${card.publicId}/${card.slug ?? ''}`,
          title: card.headline,
          propertyType:
            card.propertyType === 'APARTMENT'
              ? filterT('typeApartment')
              : card.propertyType === 'VILLA'
                ? filterT('typeVilla')
                : card.propertyType === 'TOWNHOUSE'
                  ? filterT('typeTownhouse')
                  : card.propertyType === 'PENTHOUSE'
                    ? filterT('typePenthouse')
                    : card.propertyType,
          askingPriceAed: card.askingPriceAed,
          emirate: card.emirate,
          community: card.community,
          bedrooms: card.bedrooms,
          bathrooms: card.bathrooms,
          sizeSqft: card.sizeSqft,
          coverUrl: card.coverUrl,
        },
      ];
    })
    .slice(0, MAX_INTERNAL_CARDS);
  const externalCards: FeaturedCard[] = (external.data?.items ?? [])
    .slice(0, MAX_CARDS - internalCards.length)
    .map((card) => ({
      kind: 'external',
      id: card.providerId,
      href: card.externalUrl,
      title: card.title,
      propertyType: card.propertyType,
      askingPriceAed: card.askingPriceAed,
      emirate: card.emirate,
      community: card.community,
      bedrooms: card.bedrooms,
      bathrooms: card.bathrooms,
      sizeSqft: card.sizeSqft,
      coverUrl: card.coverUrl,
    }));
  const cards = [...internalCards, ...externalCards];
  const isInitialLoading = internal.isLoading || external.isLoading;
  const isUnavailable =
    internal.isError &&
    (external.isError || external.data?.enabled === false || external.data?.available === false);

  return (
    <section
      className="border-primary/15 mt-4 border-t pt-16"
      aria-labelledby="featured-properties-title"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <h2
            id="featured-properties-title"
            className="font-display text-primary text-3xl font-medium"
          >
            {t('featuredTitle')}
          </h2>
          <p className="text-muted-foreground mt-2">{t('featuredBody')}</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/properties">{t('featuredViewAll')}</Link>
        </Button>
      </div>

      {isInitialLoading ? (
        <div role="status">
          <span className="sr-only">{t('featuredLoading')}</span>
          <FeaturedPropertiesSkeleton />
        </div>
      ) : cards.length === 0 ? (
        <Card className="mt-6 border-dashed p-8 text-center">
          <p className="font-medium">
            {isUnavailable ? t('featuredUnavailableTitle') : t('featuredEmptyTitle')}
          </p>
          <p className="text-muted-foreground mx-auto mt-2 max-w-xl text-sm">
            {isUnavailable ? t('featuredUnavailableBody') : t('featuredEmptyBody')}
          </p>
        </Card>
      ) : (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => {
            const beds =
              card.bedrooms === 0
                ? propertyT('bedsStudio')
                : card.bedrooms != null
                  ? propertyT('beds', { count: card.bedrooms })
                  : null;
            const content = (
              <>
                <div className="bg-muted relative aspect-[4/3] w-full overflow-hidden">
                  {card.coverUrl ? (
                    // A plain image avoids copying third-party listing images into Next's
                    // optimisation cache; the server projection already allowlists hosts.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={card.coverUrl}
                      alt={card.title}
                      loading="lazy"
                      referrerPolicy={card.kind === 'external' ? 'no-referrer' : undefined}
                      className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                    />
                  ) : (
                    <div className="text-muted-foreground flex h-full items-center justify-center p-4 text-center text-sm">
                      {propertyT('imageUnavailable')}
                    </div>
                  )}
                  <Badge className="bg-background/95 text-foreground absolute start-3 top-3 shadow-none">
                    {card.kind === 'internal'
                      ? t('featuredSourceMarkaz')
                      : t('featuredSourceBayut')}
                  </Badge>
                </div>

                <div className="flex flex-1 flex-col gap-2 p-4">
                  <p className="text-lg font-semibold">{formatAed(card.askingPriceAed, locale)}</p>
                  <p className="text-foreground line-clamp-2 text-sm font-medium">{card.title}</p>
                  <p className="text-muted-foreground text-sm">
                    {[card.community, card.emirate].filter(Boolean).join(' · ')}
                  </p>
                  {card.propertyType && (
                    <Badge variant="outline" className="w-fit">
                      {card.propertyType}
                    </Badge>
                  )}

                  <div className="text-muted-foreground mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-2 text-sm">
                    {beds && (
                      <span className="inline-flex items-center gap-1">
                        <BedDouble className="h-4 w-4" aria-hidden /> {beds}
                      </span>
                    )}
                    {card.bathrooms != null && (
                      <span className="inline-flex items-center gap-1">
                        <Bath className="h-4 w-4" aria-hidden />
                        {propertyT('baths', { count: card.bathrooms })}
                      </span>
                    )}
                    {card.sizeSqft != null && (
                      <span className="inline-flex items-center gap-1">
                        <Maximize className="h-4 w-4" aria-hidden />
                        {propertyT('sqft', { size: formatNumber(card.sizeSqft, locale) })}
                      </span>
                    )}
                  </div>

                  <span className="text-primary mt-2 inline-flex items-center gap-1 text-sm font-medium">
                    {card.kind === 'internal'
                      ? t('featuredOpenInternal')
                      : t('featuredOpenExternal')}
                    {card.kind === 'external' && (
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                    )}
                  </span>
                </div>
              </>
            );

            return (
              <Card
                key={`${card.kind}-${card.id}`}
                className="border-primary/15 bg-card/80 group flex overflow-hidden"
              >
                {card.kind === 'internal' ? (
                  <Link
                    href={card.href}
                    className="focus-visible:ring-ring flex min-w-0 flex-1 flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset"
                  >
                    {content}
                  </Link>
                ) : (
                  <a
                    href={card.href}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="focus-visible:ring-ring flex min-w-0 flex-1 flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset"
                  >
                    {content}
                  </a>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {!isInitialLoading && externalCards.length > 0 && (
        <p className="text-muted-foreground mt-4 text-xs">{t('featuredExternalNotice')}</p>
      )}
    </section>
  );
}

function FeaturedPropertiesSkeleton() {
  return (
    <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
      {Array.from({ length: 3 }, (_, index) => (
        <Skeleton key={index} className="aspect-[4/3] w-full rounded-lg" />
      ))}
    </div>
  );
}
