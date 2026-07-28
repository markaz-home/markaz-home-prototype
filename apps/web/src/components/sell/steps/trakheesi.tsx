'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { Alert, Badge, Button } from '@markaz/ui';
import { trpc } from '@/trpc/react';
import { PermitQr } from '../permit-qr';
import { useRouter } from '@/i18n/navigation';
import {
  WizardShell,
  WizardLoading,
  ListingUnavailable,
  SimDisclosure,
  formatAed,
  type WizardListing,
} from '../wizard';
import { useListing } from './step-shared';

// --- Simulated Trakheesi ----------------------------------------------------
export function TrakheesiStep({ listingId }: { listingId: string }) {
  const get = useListing(listingId);
  const status = trpc.listing.permit.status.useQuery(
    { listingId },
    { refetchInterval: (q) => (q.state.data?.status === 'PENDING' ? 1500 : false) },
  );
  const t = useTranslations('permit');
  const tlf = useTranslations('listing');
  const router = useRouter();
  const utils = trpc.useUtils();
  const [confirmed, setConfirmed] = useState(false);
  const submit = trpc.listing.permit.submit.useMutation({
    onSuccess: () => {
      status.refetch();
      utils.listing.get.invalidate({ listingId });
    },
  });

  if (get.error) return <ListingUnavailable />;
  if (!get.data) return <WizardLoading />;
  const st = status.data?.status ?? 'NOT_STARTED';
  const permitNumber = status.data?.permitNumber ?? null;

  return (
    <WizardShell listing={get.data as unknown as WizardListing} current="trakheesi">
      <div className="space-y-6">
        <SimDisclosure title={t('disclosureTitle')} body={t('disclosureBody')} />
        {st === 'NOT_STARTED' ? (
          <>
            <div>
              <h1 className="font-display text-foreground text-2xl font-medium">
                {t('prepareTitle')}
              </h1>
              <p className="text-muted-foreground mt-1">{t('prepareBody')}</p>
            </div>
            <div className="rounded-lg border p-4 text-sm">
              <p>
                {get.data.property?.buildingOrProject} · {get.data.property?.community}
              </p>
              <p className="text-muted-foreground">{formatAed(get.data.askingPriceAed)}</p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              <span>{t('confirm')}</span>
            </label>
            <Button
              disabled={!confirmed}
              loading={submit.isPending}
              onClick={() => submit.mutate({ listingId, confirm: true })}
            >
              {t('submit')}
            </Button>
          </>
        ) : st === 'PENDING' ? (
          <>
            <div className="flex items-center justify-between">
              <h1 className="font-display text-foreground text-2xl font-medium">
                {t('pendingTitle')}
              </h1>
              <Badge>{t('pendingStatus')}</Badge>
            </div>
            <Alert variant="info">
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                {t('pendingBody')}
              </span>
            </Alert>
            <Button variant="outline" onClick={() => status.refetch()}>
              {t('refresh')}
            </Button>
          </>
        ) : st === 'VERIFIED_DEMO' ? (
          <>
            <div className="flex items-center justify-between">
              <h1 className="font-display text-foreground text-2xl font-medium">
                {t('approvedTitle')}
              </h1>
              <Badge>{t('approvedStatus')}</Badge>
            </div>
            <Alert variant="info">{t('approvedBody')}</Alert>
            {/* Permit card: the code sits on a light tile because that is how a
                real permit QR is printed, with the disclosure beside it. */}
            <div className="border-border/70 bg-card/40 flex flex-col gap-4 rounded-lg border p-5 sm:flex-row sm:items-center">
              {permitNumber ? <PermitQr permitNumber={permitNumber} /> : null}
              <div className="min-w-0">
                <p className="text-sm font-medium">{t('qrLabel')}</p>
                <p className="text-muted-foreground mt-1 text-xs">{t('qrHelp')}</p>
                {permitNumber ? (
                  <p className="text-muted-foreground mt-2 text-xs">
                    {t('permitNumberLabel')} <span className="text-foreground">{permitNumber}</span>
                  </p>
                ) : null}
              </div>
            </div>
            <div className="flex justify-end border-t pt-4">
              <Button onClick={() => router.push(`/sell/listings/${listingId}/review`)}>
                {t('reviewListing')}
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <h1 className="font-display text-foreground text-2xl font-medium">
                {t('failTitle')}
              </h1>
              <Badge variant="destructive">{tlf('sectionFailed')}</Badge>
            </div>
            <Alert variant="destructive">{t('failBody')}</Alert>
            <Button
              loading={submit.isPending}
              onClick={() => submit.mutate({ listingId, confirm: true })}
            >
              {t('retry')}
            </Button>
          </>
        )}
      </div>
    </WizardShell>
  );
}
