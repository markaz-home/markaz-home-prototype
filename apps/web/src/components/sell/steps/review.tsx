'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Alert, Button } from '@markaz/ui';
import { trpc } from '@/trpc/react';
import { useRouter, Link } from '@/i18n/navigation';
import {
  WizardShell,
  WizardLoading,
  ListingUnavailable,
  SectionBadge,
  type WizardListing,
} from '../wizard';
import { StepHeader, useListing } from './step-shared';

// --- Review -----------------------------------------------------------------
const REVIEW_ROWS: { section: string; labelKey: string; step: string }[] = [
  { section: 'details', labelKey: 'secDetails', step: 'details' },
  { section: 'ownership', labelKey: 'secOwnership', step: 'ownership' },
  { section: 'verification', labelKey: 'secVerification', step: 'verification' },
  { section: 'settings', labelKey: 'secSettings', step: 'settings' },
  { section: 'investment', labelKey: 'secInvestment', step: 'investment-case' },
  { section: 'formA', labelKey: 'secFormA', step: 'form-a' },
  { section: 'photos', labelKey: 'secPhotos', step: 'photos' },
  { section: 'permit', labelKey: 'secPermit', step: 'trakheesi' },
];
export function ReviewStep({ listingId }: { listingId: string }) {
  const get = useListing(listingId);
  const t = useTranslations('review');
  const tl = useTranslations('listing');
  const router = useRouter();
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const markReady = trpc.listing.review.markReady.useMutation();
  if (get.error) return <ListingUnavailable />;
  if (!get.data) return <WizardLoading />;
  const { sections, readiness } = get.data;

  async function onConfirm() {
    if (!confirmed) return;
    setError(null);
    try {
      await markReady.mutateAsync({ listingId, confirm: true });
      router.push(`/sell/listings/${listingId}/ready`);
    } catch {
      setError(t('itemsBody'));
    }
  }

  return (
    <WizardShell listing={get.data as unknown as WizardListing} current="review">
      <div className="space-y-6">
        <StepHeader ns="review" />
        {readiness.ready ? (
          <Alert variant="success" title={t('allComplete')}>
            {t('allCompleteBody')}
          </Alert>
        ) : (
          <Alert
            variant="warning"
            title={t('itemsNeedAttention', { count: readiness.blocking.length })}
          >
            {t('itemsBody')}
          </Alert>
        )}
        <ul className="divide-y rounded-lg border">
          {REVIEW_ROWS.map((r) => (
            <li key={r.section} className="flex items-center justify-between gap-3 p-3">
              <span className="text-sm font-medium">{t(r.labelKey)}</span>
              <div className="flex items-center gap-3">
                <SectionBadge status={sections[r.section as keyof typeof sections]} />
                <Link
                  href={`/sell/listings/${listingId}/${r.step}`}
                  className="text-primary text-sm hover:underline"
                >
                  {tl('edit')}
                </Link>
              </div>
            </li>
          ))}
        </ul>
        <Alert variant="info" title={t('prototypeTitle')}>
          {t('prototypeBody')}
        </Alert>
        <Alert variant="info" title={t('notPublicTitle')}>
          {t('notPublicBody')}
        </Alert>
        {error ? <Alert variant="destructive">{error}</Alert> : null}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          <span>{t('confirmReview')}</span>
        </label>
        <div className="flex justify-end border-t pt-4">
          <Button
            disabled={!readiness.ready || !confirmed}
            loading={markReady.isPending}
            onClick={onConfirm}
          >
            {t('markReady')}
          </Button>
        </div>
      </div>
    </WizardShell>
  );
}
