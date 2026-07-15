'use client';
import { useTranslations } from 'next-intl';
import { ShieldCheck, ShieldAlert, Loader2 } from 'lucide-react';
import { Alert, Badge, Button } from '@markaz/ui';
import { trpc } from '@/trpc/react';
import { useRouter } from '@/i18n/navigation';
import {
  WizardShell,
  WizardLoading,
  ListingUnavailable,
  SimDisclosure,
  type WizardListing,
} from '../wizard';
import { useListing } from './step-shared';

// --- Ownership verification -------------------------------------------------
export function VerificationStep({ listingId }: { listingId: string }) {
  const get = useListing(listingId);
  const status = trpc.listing.verification.status.useQuery(
    { listingId },
    { refetchInterval: (q) => (q.state.data?.status === 'PENDING' ? 1500 : false) },
  );
  const t = useTranslations('verification');
  const tl = useTranslations('listing');
  const router = useRouter();
  const utils = trpc.useUtils();
  const start = trpc.listing.verification.start.useMutation({
    onSuccess: () => {
      status.refetch();
      utils.listing.get.invalidate({ listingId });
    },
  });

  if (get.error) return <ListingUnavailable />;
  if (!get.data) return <WizardLoading />;
  const st = status.data?.status ?? 'NOT_STARTED';

  return (
    <WizardShell listing={get.data as unknown as WizardListing} current="verification">
      <div className="space-y-6">
        <SimDisclosure title={t('disclosureTitle')} body={t('disclosureBody')} />
        {st === 'NOT_STARTED' || st === undefined ? (
          <>
            <div>
              <h1 className="font-display text-brand-900 text-2xl font-medium">
                {t('startTitle')}
              </h1>
              <p className="text-muted-foreground mt-1">{t('startBody')}</p>
            </div>
            <Button loading={start.isPending} onClick={() => start.mutate({ listingId })}>
              {t('start')}
            </Button>
            <p className="text-muted-foreground text-xs">{t('startHelp')}</p>
          </>
        ) : st === 'PENDING' ? (
          <>
            <div className="flex items-center justify-between">
              <h1 className="font-display text-brand-900 text-2xl font-medium">
                {t('pendingTitle')}
              </h1>
              <Badge variant="default">{t('pendingStatus')}</Badge>
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
              <h1 className="font-display text-brand-900 text-2xl font-medium">
                {t('successTitle')}
              </h1>
              <Badge variant="success">{t('successStatus')}</Badge>
            </div>
            <Alert variant="success">
              <span className="inline-flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" aria-hidden />
                {t('successBody')}
              </span>
            </Alert>
            <Button onClick={() => router.push(`/sell/listings/${listingId}/settings`)}>
              {t('continue')}
            </Button>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <h1 className="font-display text-brand-900 text-2xl font-medium">{t('failTitle')}</h1>
              <Badge variant="destructive">{tl('sectionFailed')}</Badge>
            </div>
            <Alert variant="destructive">
              <span className="inline-flex items-center gap-2">
                <ShieldAlert className="h-4 w-4" aria-hidden />
                {t('failBody')}
              </span>
            </Alert>
            <div className="flex gap-2">
              <Button loading={start.isPending} onClick={() => start.mutate({ listingId })}>
                {t('retry')}
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push(`/sell/listings/${listingId}/ownership`)}
              >
                {t('replaceDoc')}
              </Button>
            </div>
          </>
        )}
      </div>
    </WizardShell>
  );
}
