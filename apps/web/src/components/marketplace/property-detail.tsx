'use client';

import { useEffect, useRef, useState } from 'react';
import { Bath, BedDouble, Car, Maximize, Share2, Sofa } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Alert, Badge, Button, Card, CardContent, toast } from '@markaz/ui';
import { Link } from '@/i18n/navigation';
import { trpc } from '@/trpc/react';
import { formatAed, formatNumber, formatPct } from '@/lib/format';
import type { RouterOutputs } from '@/trpc/types';
import { SaveButton } from './save-button';
import { PropertyGallery } from './property-gallery';
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
  const tf = useTranslations('filters');
  const ti = useTranslations('investmentCase');
  const ts = useTranslations('save');
  const tm = useTranslations('marketplace');
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
  const furn = detail.furnishingStatus ? tf(`furnishing${detail.furnishingStatus}` as 'furnishingFURNISHED') : null;
  const comp = detail.completionStatus ? tf(`completion${detail.completionStatus}` as 'completionREADY') : null;

  return (
    <div className="container max-w-[1360px] py-8">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted-foreground">
        <Link href="/properties" className="hover:text-foreground">{t('breadcrumb')}</Link>
        {detail.community && <span> · {detail.community}</span>}
      </nav>

      <Alert className="mb-4">
        <p className="font-medium">{tm('prototypeTitle')}</p>
        <p className="text-sm text-muted-foreground">{tm('prototypeBody')}</p>
      </Alert>

      <PropertyGallery photos={detail.photoUrls} headline={detail.headline} />

      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-3xl font-semibold">{formatAed(detail.askingPriceAed, locale)}</p>
          <h1 className="mt-1 text-xl font-medium">{detail.headline}</h1>
          <p className="mt-1 text-muted-foreground">
            {[detail.community, detail.emirate].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {detail.isOwner ? (
            <>
              <Badge variant="outline">{t('yourListing')}</Badge>
              {detail.manageListingId && (
                <Button asChild>
                  <Link href={`/sell/listings/${detail.manageListingId}/manage`}>{t('manage')}</Link>
                </Button>
              )}
            </>
          ) : (
            <SaveButton publicId={detail.publicId ?? ''} isAuthenticated={isAuthenticated} returnPath={returnPath} initialSaved={initialSaved} variant="full" />
          )}
          <Button variant="outline" onClick={share}>
            <Share2 className="h-4 w-4 me-2" /> {t('share')}
          </Button>
        </div>
      </div>

      {/* Core facts */}
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-y py-4 text-sm">
        {detail.bedrooms != null && <Fact icon={<BedDouble className="h-4 w-4" />} label={detail.bedrooms === 0 ? t('bedsStudio') : t('beds', { count: detail.bedrooms })} />}
        {detail.bathrooms != null && <Fact icon={<Bath className="h-4 w-4" />} label={t('baths', { count: detail.bathrooms })} />}
        {detail.sizeSqft != null && <Fact icon={<Maximize className="h-4 w-4" />} label={t('sqft', { size: formatNumber(detail.sizeSqft, locale) })} />}
        {furn && <Fact icon={<Sofa className="h-4 w-4" />} label={furn} />}
        {detail.parkingSpaces != null && detail.parkingSpaces > 0 && <Fact icon={<Car className="h-4 w-4" />} label={t('parkingSpaces', { count: detail.parkingSpaces })} />}
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          {detail.description && (
            <section>
              <h2 className="text-lg font-semibold">{t('about')}</h2>
              <div className="mt-2 whitespace-pre-line text-sm leading-relaxed text-foreground" dir="auto">{detail.description}</div>
            </section>
          )}

          {detail.features.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold">{t('amenities')}</h2>
              <ul className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                {detail.features.map((f) => <li key={f} className="rounded-md bg-muted px-3 py-2">{titleCaseFeature(f)}</li>)}
              </ul>
            </section>
          )}

          <section>
            <h2 className="text-lg font-semibold">{t('details')}</h2>
            <dl className="mt-2 grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
              {detail.propertyType && <Row label={t('labelType')} value={tf(`type${titleCase(detail.propertyType)}` as 'typeApartment')} />}
              {detail.community && <Row label={t('labelCommunity')} value={detail.community} />}
              {detail.buildingOrProject && <Row label={t('labelBuilding')} value={detail.buildingOrProject} />}
              {detail.sizeSqft != null && <Row label={t('labelSize')} value={t('sqft', { size: formatNumber(detail.sizeSqft, locale) })} />}
              {furn && <Row label={t('labelFurnishing')} value={furn} />}
              {comp && <Row label={t('labelCompletion')} value={comp} />}
              {detail.parkingSpaces != null && <Row label={t('labelParking')} value={String(detail.parkingSpaces)} />}
            </dl>
          </section>

          <Alert>
            <p className="font-medium">{t('directTitle')}</p>
            <p className="text-sm text-muted-foreground">{t('directBody')}</p>
          </Alert>
        </div>

        {/* Investment Case rail */}
        {ic && (
          <aside className="lg:col-span-1">
            <Card>
              <CardContent className="space-y-4 pt-6">
                <div>
                  <h2 className="text-lg font-semibold">{ti('title')}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{ti('intro')}</p>
                </div>
                <dl className="space-y-3">
                  <Metric label={ti('roi')} value={formatPct(ic.estimatedRoiPct, locale)} />
                  <Metric label={ti('annualised')} value={ic.estimatedAnnualisedReturnPct != null ? formatPct(ic.estimatedAnnualisedReturnPct, locale) : ti('unavailable')} />
                  <Metric label={ti('priceSqft')} value={formatAed(ic.pricePerSqftAed, locale)} />
                </dl>
                <p className="text-xs leading-relaxed text-muted-foreground">{ti('disclosure')}</p>
              </CardContent>
            </Card>
          </aside>
        )}
      </div>

      <span role="status" aria-live="polite" className="sr-only">{announce}</span>
    </div>
  );
}

function Fact({ icon, label }: { icon: React.ReactNode; label: string }) {
  return <span className="inline-flex items-center gap-1.5 text-muted-foreground">{icon}<span className="text-foreground">{label}</span></span>;
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b py-1.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium" dir="auto">{value}</dd>
    </div>
  );
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-lg font-semibold">{value}</dd>
    </div>
  );
}
function titleCase(s: string): string {
  return s.charAt(0) + s.slice(1).toLowerCase();
}
function titleCaseFeature(s: string): string {
  return s.split('_').map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
}
