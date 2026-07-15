'use client';
import { useTranslations } from 'next-intl';
import { ShieldCheck } from 'lucide-react';
import { Badge, Button } from '@markaz/ui';
import { useRouter } from '@/i18n/navigation';
import { ListingUnavailable } from '../wizard';
import { useListing } from './step-shared';

// --- Ready ------------------------------------------------------------------
export function ReadyScreen({ listingId }: { listingId: string }) {
  const t = useTranslations('ready');
  const tpub = useTranslations('publication');
  const router = useRouter();
  const get = useListing(listingId);
  if (get.error) return <ListingUnavailable />;
  return (
    <div className="mx-auto max-w-xl py-8 text-center">
      <ShieldCheck className="text-success mx-auto h-12 w-12" aria-hidden />
      <h1 className="font-display text-brand-900 mt-4 text-3xl font-medium">
        {tpub('readyTitle')}
      </h1>
      <p className="text-muted-foreground mt-2">{tpub('readyBody')}</p>
      <div className="mx-auto mt-4 inline-flex flex-col items-center gap-2">
        <Badge variant="success">{tpub('readyStatus')}</Badge>
      </div>
      <p className="text-muted-foreground mt-4 text-sm">{tpub('privacy')}</p>
      <div className="mt-6 flex flex-col items-center gap-2">
        <Button onClick={() => router.push(`/sell/listings/${listingId}/publish`)}>
          {tpub('publish')}
        </Button>
        <Button
          variant="outline"
          onClick={() => router.push(`/sell/listings/${listingId}/preview`)}
        >
          {tpub('preview')}
        </Button>
        <Button variant="ghost" onClick={() => router.push(`/sell/listings/${listingId}/details`)}>
          {t('editListing')}
        </Button>
      </div>
    </div>
  );
}
