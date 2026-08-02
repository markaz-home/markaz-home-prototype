'use client';
import { useTranslations } from 'next-intl';
import { Lock, ShieldCheck } from 'lucide-react';
import { Badge, Button } from '@markaz/ui';
import { useRouter } from '@/i18n/navigation';
import { ListingUnavailable } from '../wizard';
import { useListing } from './step-shared';

// --- Ready ------------------------------------------------------------------
export function ReadyScreen({ listingId }: { listingId: string }) {
  const tpub = useTranslations('publication');
  const router = useRouter();
  const get = useListing(listingId);
  if (get.error) return <ListingUnavailable />;
  return (
    <div className="mx-auto max-w-lg py-4 text-center">
      {/* Gold halo rather than a green tick: completion is on-palette here. */}
      <span
        aria-hidden
        className="border-primary/30 bg-primary/10 mx-auto grid h-16 w-16 place-items-center rounded-full border"
      >
        <ShieldCheck className="text-primary h-8 w-8" />
      </span>

      <h1 className="font-display text-foreground mt-5 text-3xl font-medium">
        {tpub('readyTitle')}
      </h1>
      <div className="mt-3 flex justify-center">
        <Badge>{tpub('readyStatus')}</Badge>
      </div>
      <p className="text-muted-foreground mx-auto mt-3 max-w-md text-sm">{tpub('readyBody')}</p>

      {/* One decisive action, its rehearsal beside it; editing stays quiet. */}
      <div className="mt-7 flex flex-col items-stretch justify-center gap-2 sm:flex-row">
        <Button
          className="rounded-full sm:min-w-[11rem]"
          onClick={() => router.push(`/sell/listings/${listingId}/publish`)}
        >
          {tpub('publish')}
        </Button>
        <Button
          variant="outline"
          className="rounded-full sm:min-w-[11rem]"
          onClick={() => router.push(`/sell/listings/${listingId}/preview`)}
        >
          {tpub('preview')}
        </Button>
      </div>
      <button
        type="button"
        onClick={() => router.push(`/sell/listings/${listingId}/details`)}
        className="text-muted-foreground hover:text-foreground mt-4 text-sm underline-offset-4 hover:underline"
      >
        {tpub('editListing')}
      </button>

      <p className="text-muted-foreground border-border/60 mt-8 flex items-start gap-2 border-t pt-5 text-start text-xs">
        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        {tpub('privacy')}
      </p>
    </div>
  );
}
