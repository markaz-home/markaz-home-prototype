'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Bath, BedDouble, Maximize } from 'lucide-react';
import { Alert, Badge, Button } from '@markaz/ui';
import { trpc } from '@/trpc/react';
import { useRouter } from '@/i18n/navigation';
import { WizardLoading, ListingUnavailable, formatAed } from '../wizard';
import { DRAFT_PHOTO_BUCKET, getSignedUrls } from '@/lib/listing-storage';
import { supabase } from './step-shared';

// --- Owner-only preview -----------------------------------------------------
export function PreviewScreen({ listingId }: { listingId: string }) {
  const t = useTranslations('preview');
  const ti = useTranslations('investment');
  const ta = useTranslations('amenities');
  const tp = useTranslations('property');
  const router = useRouter();
  const preview = trpc.listing.preview.useQuery({ listingId });
  const [urls, setUrls] = useState<Record<string, string>>({});
  const paths = preview.data?.photoPaths ?? [];
  useEffect(() => {
    if (paths.length === 0) return;
    getSignedUrls(supabase(), DRAFT_PHOTO_BUCKET, paths)
      .then(setUrls)
      .catch(() => {});
  }, [paths.join(',')]);

  if (preview.error) return <ListingUnavailable />;
  if (!preview.data) return <WizardLoading />;
  const d = preview.data;
  const cover = d.coverPhotoPath ? urls[d.coverPhotoPath] : undefined;
  const p = d.property;
  const beds =
    p?.bedrooms === 0
      ? tp('bedsStudio')
      : p?.bedrooms != null
        ? tp('beds', { count: p.bedrooms })
        : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-6">
      <Alert variant="info" title={t('bannerTitle')}>
        {t('bannerBody')}
      </Alert>

      {/* One card, as the public page presents it: cover, then the facts. */}
      <article className="border-border/70 bg-card/40 overflow-hidden rounded-lg border">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" className="bg-muted aspect-[16/9] w-full object-cover" />
        ) : null}

        <div className="space-y-5 p-6">
          <header>
            <h1 className="font-display text-foreground text-3xl font-medium" dir="auto">
              {d.title}
            </h1>
            <p className="text-primary mt-2 text-2xl font-semibold tabular-nums" dir="ltr">
              {formatAed(d.askingPriceAed)}
            </p>
            {p ? (
              <div className="text-muted-foreground mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
                {beds ? (
                  <span className="inline-flex items-center gap-1.5">
                    <BedDouble className="h-4 w-4" aria-hidden /> {beds}
                  </span>
                ) : null}
                {p.bathrooms != null ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Bath className="h-4 w-4" aria-hidden /> {tp('baths', { count: p.bathrooms })}
                  </span>
                ) : null}
                {p.sizeSqft != null ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Maximize className="h-4 w-4" aria-hidden />{' '}
                    {tp('sqft', { size: String(p.sizeSqft) })}
                  </span>
                ) : null}
              </div>
            ) : null}
          </header>

          {d.description ? (
            <p className="text-muted-foreground whitespace-pre-line text-sm leading-relaxed">
              {d.description}
            </p>
          ) : null}

          {p?.features?.length ? (
            <ul className="flex flex-wrap gap-2">
              {p.features.map((f) => (
                <li key={f}>
                  <Badge variant="outline">{ta(f)}</Badge>
                </li>
              ))}
            </ul>
          ) : null}

          {d.investmentCase ? (
            <section className="border-border/60 border-t pt-5">
              <h2 className="text-muted-foreground text-xs font-semibold uppercase tracking-[0.14em]">
                {ti('summaryTitle')}
              </h2>
              {/* Figures read as figures: label above, value large and aligned. */}
              <dl className="mt-3 grid grid-cols-2 gap-3">
                <Stat
                  label={ti('estimatedRoi')}
                  value={
                    d.investmentCase.estimatedRoiPct != null
                      ? `${d.investmentCase.estimatedRoiPct}%`
                      : '-'
                  }
                />
                <Stat
                  label={ti('annualised')}
                  value={
                    d.investmentCase.estimatedAnnualisedReturnPct != null
                      ? `${d.investmentCase.estimatedAnnualisedReturnPct}%`
                      : '-'
                  }
                />
              </dl>
            </section>
          ) : null}
        </div>
      </article>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="outline" onClick={() => router.push(`/sell/listings/${listingId}/ready`)}>
          {t('backToReady')}
        </Button>
        <button
          type="button"
          onClick={() => router.push(`/sell/listings/${listingId}/details`)}
          className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline"
        >
          {t('editListing')}
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border/70 bg-background/40 rounded-lg border p-3">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-1 text-xl font-semibold tabular-nums" dir="ltr">
        {value}
      </dd>
    </div>
  );
}
