'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
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

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-6">
      <Alert variant="info" title={t('bannerTitle')}>
        {t('bannerBody')}
      </Alert>
      {cover ? (
        <img
          src={cover}
          alt={d.title ?? 'cover'}
          className="bg-muted aspect-[16/9] w-full rounded-lg object-cover"
        />
      ) : null}
      <div>
        <h1 className="font-display text-brand-900 text-3xl font-medium">{d.title}</h1>
        <p className="mt-1 text-xl font-medium">{formatAed(d.askingPriceAed)}</p>
      </div>
      {d.property ? (
        <p className="text-muted-foreground text-sm">
          {[
            d.property.bedrooms === 0 ? 'Studio' : `${d.property.bedrooms} bd`,
            `${d.property.bathrooms} ba`,
            d.property.sizeSqft ? `${d.property.sizeSqft} sq ft` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      ) : null}
      {d.description ? <p className="whitespace-pre-line text-sm">{d.description}</p> : null}
      {d.property?.features?.length ? (
        <ul className="flex flex-wrap gap-2">
          {d.property.features.map((f) => (
            <li key={f}>
              <Badge variant="outline">{f.toLowerCase().replace(/_/g, ' ')}</Badge>
            </li>
          ))}
        </ul>
      ) : null}
      {d.investmentCase ? (
        <div className="rounded-lg border p-4 text-sm">
          <p className="mb-1 font-medium">{ti('summaryTitle')}</p>
          <p>
            {ti('estimatedRoi')}: {d.investmentCase.estimatedRoiPct ?? '—'}%
          </p>
          <p>
            {ti('annualised')}: {d.investmentCase.estimatedAnnualisedReturnPct ?? '—'}%
          </p>
        </div>
      ) : null}
      <div className="flex gap-3 border-t pt-4">
        <Button variant="outline" onClick={() => router.push(`/sell/listings/${listingId}/ready`)}>
          {t('backToReady')}
        </Button>
        <Button variant="ghost" onClick={() => router.push(`/sell/listings/${listingId}/details`)}>
          {t('editListing')}
        </Button>
      </div>
    </div>
  );
}
