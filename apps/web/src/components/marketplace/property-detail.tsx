'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Bath, BedDouble, Car, Info, Maximize, Share2, Sofa } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Badge, Button, Card, CardContent, toast } from '@markaz/ui';
import { Link } from '@/i18n/navigation';
import { trpc } from '@/trpc/react';
import { formatAed, formatNumber, formatPct } from '@/lib/format';
import type { RouterOutputs } from '@/trpc/types';
import { SaveButton } from './save-button';
import { PropertyGallery } from './property-gallery';
import { MakeOfferButton } from '@/components/offers/make-offer-button';
import { readSaveIntent, clearSaveIntent } from '@/lib/save-intent';

type Detail = NonNullable<RouterOutputs['marketplace']['getByPublicId']>;

export function PropertyDetail({
  detail,
  isAuthenticated,
  initialSaved,
}: {
  detail: Detail;
  isAuthenticated: boolean;
  initialSaved: boolean;
}) {
  const t = useTranslations('property');
  const to = useTranslations('offers');
  const tf = useTranslations('filters');
  const ti = useTranslations('investmentCase');
  const ts = useTranslations('save');
  const ta = useTranslations('amenities');
  const locale = useLocale();
  const [announce, setAnnounce] = useState('');
  const returnPath = `/${locale}/properties/${detail.publicId}/${detail.slug ?? ''}`;

  // Complete a deferred anonymous save once the visitor is authenticated (§28).
  const save = trpc.marketplace.saved.save.useMutation();
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current || !isAuthenticated) return;
    const intent = readSaveIntent();
    if (!intent || intent.publicId !== detail.publicId) return;
    ran.current = true;
    clearSaveIntent();
    if (detail.isOwner) return;
    save
      .mutateAsync({ publicId: detail.publicId! })
      .then(() => setAnnounce(ts('success')))
      .catch(() => setAnnounce(ts('unavailableReturn')));
  }, [isAuthenticated]);

  async function share() {
    const url = typeof window !== 'undefined' ? window.location.href : returnPath;
    try {
      if (navigator.share) await navigator.share({ url, title: detail.headline });
      else {
        await navigator.clipboard.writeText(url);
        toast(t('linkCopied'));
      }
    } catch {
      /* user dismissed share sheet — no action */
    }
  }

  const ic = detail.investmentCase;
  const furn = detail.furnishingStatus
    ? tf(`furnishing${detail.furnishingStatus}` as 'furnishingFURNISHED')
    : null;
  const comp = detail.completionStatus
    ? tf(`completion${detail.completionStatus}` as 'completionREADY')
    : null;

  return (
    <div className="container max-w-[1360px] py-8">
      <nav
        aria-label="Breadcrumb"
        className="text-muted-foreground mb-4 flex flex-wrap items-center gap-1.5 text-sm"
      >
        <Link href="/properties" className="hover:text-foreground inline-flex items-center gap-1.5">
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden />
          {t('breadcrumb')}
        </Link>
        {detail.community && <span>· {detail.community}</span>}
      </nav>

      <PropertyGallery photos={detail.photoUrls} headline={detail.headline} />

      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-medium tracking-tight" dir="auto">
            {detail.headline}
          </h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            {[detail.community, detail.emirate].filter(Boolean).join(' · ')}
          </p>
          <p className="text-primary mt-3 text-3xl font-semibold tabular-nums" dir="ltr">
            {formatAed(detail.askingPriceAed, locale)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {detail.isOwner ? (
            <>
              <Badge variant="outline">{t('yourListing')}</Badge>
              {detail.manageListingId && (
                <>
                  <Button variant="outline" asChild>
                    <Link href={`/sell/listings/${detail.manageListingId}/offers`}>
                      {to('cta.viewOffers')}
                    </Link>
                  </Button>
                  <Button asChild>
                    <Link href={`/sell/listings/${detail.manageListingId}/manage`}>
                      {t('manage')}
                    </Link>
                  </Button>
                </>
              )}
            </>
          ) : (
            <>
              <SaveButton
                publicId={detail.publicId ?? ''}
                isAuthenticated={isAuthenticated}
                returnPath={returnPath}
                initialSaved={initialSaved}
                variant="icon"
              />
              <MakeOfferButton
                publicId={detail.publicId ?? ''}
                slug={detail.slug ?? ''}
                isAuthenticated={isAuthenticated}
              />
            </>
          )}
          <Button variant="outline" onClick={share}>
            <Share2 className="me-2 h-4 w-4" /> {t('share')}
          </Button>
        </div>
      </div>

      {/* Core facts */}
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-y py-4 text-sm">
        {detail.bedrooms != null && (
          <Fact
            icon={<BedDouble className="h-4 w-4" />}
            label={detail.bedrooms === 0 ? t('bedsStudio') : t('beds', { count: detail.bedrooms })}
          />
        )}
        {detail.bathrooms != null && (
          <Fact
            icon={<Bath className="h-4 w-4" />}
            label={t('baths', { count: detail.bathrooms })}
          />
        )}
        {detail.sizeSqft != null && (
          <Fact
            icon={<Maximize className="h-4 w-4" />}
            label={t('sqft', { size: formatNumber(detail.sizeSqft, locale) })}
          />
        )}
        {furn && <Fact icon={<Sofa className="h-4 w-4" />} label={furn} />}
        {detail.parkingSpaces != null && detail.parkingSpaces > 0 && (
          <Fact
            icon={<Car className="h-4 w-4" />}
            label={t('parkingSpaces', { count: detail.parkingSpaces })}
          />
        )}
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          {detail.description && (
            <section>
              <h2 className="text-lg font-semibold">{t('about')}</h2>
              <div
                className="text-foreground mt-2 whitespace-pre-line text-sm leading-relaxed"
                dir="auto"
              >
                {detail.description}
              </div>
            </section>
          )}

          {detail.features.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold">{t('amenities')}</h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {detail.features.map((f) => (
                  <li key={f}>
                    <Badge variant="outline">{ta(f as 'BALCONY')}</Badge>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h2 className="text-lg font-semibold">{t('details')}</h2>
            <dl className="border-border/70 bg-card/40 mt-3 grid grid-cols-1 gap-x-8 rounded-lg border p-5 text-sm sm:grid-cols-2">
              {detail.propertyType && (
                <Row
                  label={t('labelType')}
                  value={tf(`type${titleCase(detail.propertyType)}` as 'typeApartment')}
                />
              )}
              {detail.community && <Row label={t('labelCommunity')} value={detail.community} />}
              {detail.buildingOrProject && (
                <Row label={t('labelBuilding')} value={detail.buildingOrProject} />
              )}
              {detail.sizeSqft != null && (
                <Row
                  label={t('labelSize')}
                  value={t('sqft', { size: formatNumber(detail.sizeSqft, locale) })}
                />
              )}
              {furn && <Row label={t('labelFurnishing')} value={furn} />}
              {comp && <Row label={t('labelCompletion')} value={comp} />}
              {detail.parkingSpaces != null && (
                <Row label={t('labelParking')} value={String(detail.parkingSpaces)} />
              )}
            </dl>
          </section>

          <p className="text-muted-foreground border-border/60 flex items-start gap-2 border-t pt-5 text-xs leading-relaxed">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>
              <span className="text-foreground font-medium">{t('directTitle')}</span> —{' '}
              {t('directBody')}
            </span>
          </p>
        </div>

        {/* Investment Case rail */}
        {ic && (
          <aside className="lg:sticky lg:top-24 lg:col-span-1 lg:self-start">
            <Card className="bg-card/40">
              <CardContent className="space-y-4 pt-6">
                <div>
                  <h2 className="text-lg font-semibold">{ti('title')}</h2>
                  <p className="text-muted-foreground mt-1 text-sm">{ti('intro')}</p>
                </div>
                <dl className="space-y-3">
                  <Metric label={ti('roi')} value={formatPct(ic.estimatedRoiPct, locale)} />
                  <Metric
                    label={ti('annualised')}
                    value={
                      ic.estimatedAnnualisedReturnPct != null
                        ? formatPct(ic.estimatedAnnualisedReturnPct, locale)
                        : null
                    }
                    unavailableLabel={ti('unavailable')}
                  />
                  <Metric label={ti('priceSqft')} value={formatAed(ic.pricePerSqftAed, locale)} />
                </dl>
                <p className="text-muted-foreground text-xs leading-relaxed">{ti('disclosure')}</p>
              </CardContent>
            </Card>
          </aside>
        )}
      </div>

      <span role="status" aria-live="polite" className="sr-only">
        {announce}
      </span>
    </div>
  );
}

function Fact({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="text-muted-foreground inline-flex items-center gap-1.5">
      {icon}
      <span className="text-foreground">{label}</span>
    </span>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b py-1.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium" dir="auto">
        {value}
      </dd>
    </div>
  );
}
function Metric({
  label,
  value,
  unavailableLabel,
}: {
  label: string;
  value: string | null;
  unavailableLabel?: string;
}) {
  return (
    <div className="border-border/50 flex items-baseline justify-between gap-3 border-b pb-2.5 last:border-0 last:pb-0">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      {value ? (
        <dd className="text-lg font-semibold tabular-nums" dir="ltr">
          {value}
        </dd>
      ) : (
        // Keep the row's rhythm: a dash in the value slot, the reason as a title.
        <dd className="text-muted-foreground text-lg" title={unavailableLabel}>
          —
        </dd>
      )}
    </div>
  );
}
function titleCase(s: string): string {
  return s.charAt(0) + s.slice(1).toLowerCase();
}
