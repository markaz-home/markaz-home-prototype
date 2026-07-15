'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Alert, Button } from '@markaz/ui';
import { trpc } from '@/trpc/react';
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

// --- Simulated Form A -------------------------------------------------------
export function FormAStep({ listingId }: { listingId: string }) {
  const get = useListing(listingId);
  const t = useTranslations('formA');
  const router = useRouter();
  const utils = trpc.useUtils();
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const complete = trpc.listing.formA.complete.useMutation();
  if (get.error) return <ListingUnavailable />;
  if (!get.data) return <WizardLoading />;
  const done = get.data.formA.status === 'VERIFIED_DEMO';

  async function onComplete() {
    if (!confirmed) return setError(t('errConfirm'));
    setError(null);
    const res = await complete.mutateAsync({ listingId, confirm: true });
    await utils.listing.get.invalidate({ listingId });
    if (res.status === 'COMPLETE') router.push(`/sell/listings/${listingId}/photos`);
  }

  return (
    <WizardShell listing={get.data as unknown as WizardListing} current="form-a">
      <div className="space-y-6">
        <SimDisclosure title={t('disclosureTitle')} body={t('disclosureBody')} />
        <div>
          <h1 className="font-display text-brand-900 text-2xl font-medium">{t('title')}</h1>
          <p className="text-muted-foreground mt-1">{t('description')}</p>
        </div>
        {error ? <Alert variant="destructive">{error}</Alert> : null}
        {done ? (
          <>
            <Alert variant="success" title={t('successTitle')}>
              {t('successBody')}
            </Alert>
            <Button onClick={() => router.push(`/sell/listings/${listingId}/photos`)}>
              {t('continue')}
            </Button>
          </>
        ) : (
          <>
            <div className="rounded-lg border p-4 text-sm">
              <p>
                {get.data.property?.buildingOrProject} · {get.data.property?.community}
              </p>
              <p className="text-muted-foreground">{formatAed(get.data.askingPriceAed)}</p>
            </div>
            <p className="text-muted-foreground text-sm">{t('demoStatement')}</p>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              <span>{t('confirm')}</span>
            </label>
            <Button loading={complete.isPending} onClick={onComplete}>
              {t('complete')}
            </Button>
          </>
        )}
      </div>
    </WizardShell>
  );
}
