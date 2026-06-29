'use client';

import { useState } from 'react';
import { CheckCircle2, Circle, MinusCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Alert, Button, Card, CardContent, Skeleton, cn } from '@markaz/ui';
import { Link, useRouter } from '@/i18n/navigation';
import { trpc } from '@/trpc/react';

const CHECK_ITEMS = [
  ['details', 'checkItemDetails'],
  ['ownership', 'checkItemOwnership'],
  ['price', 'checkItemPrice'],
  ['formA', 'checkItemFormA'],
  ['photos', 'checkItemPhotos'],
  ['cover', 'checkItemCover'],
  ['permit', 'checkItemPermit'],
  ['privacy', 'checkItemPrivacy'],
  ['investmentVisibility', 'checkItemInvestment'],
] as const;

const PUBLIC_ITEMS = ['publicPhotos', 'publicPrice', 'publicLocation', 'publicFacts', 'publicInvestment'] as const;
const PRIVATE_ITEMS = ['privateDocument', 'privateUnit', 'privateContact', 'privateOccupancy', 'privateVerification'] as const;

export function PublishFlow({ listingId }: { listingId: string }) {
  const t = useTranslations('publication');
  const router = useRouter();
  const checklist = trpc.listing.publication.checklist.useQuery({ listingId }, { staleTime: 0 });
  const submit = trpc.listing.publication.submit.useMutation();
  const [confirmed, setConfirmed] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [checkboxError, setCheckboxError] = useState(false);

  if (checklist.isLoading) return <Skeleton className="h-96 w-full" />;
  if (checklist.isError || !checklist.data) {
    return <Alert variant="destructive">{t('processingErrorBody')}</Alert>;
  }
  const { items, eligible } = checklist.data;

  async function onSubmit() {
    if (!confirmed) {
      setCheckboxError(true);
      return;
    }
    await submit.mutateAsync({ listingId, confirm: true });
    router.push(`/sell/listings/${listingId}/publication`);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link href="/sell" className="hover:text-foreground">{t('returnToListings')}</Link>
      </nav>

      {!showConfirm ? (
        <>
          <header>
            <h1 className="font-display text-3xl font-semibold">{t('checklistTitle')}</h1>
            <p className="mt-2 text-muted-foreground">{t('checklistBody')}</p>
          </header>

          <Card>
            <CardContent className="divide-y pt-6">
              {CHECK_ITEMS.map(([key, labelKey]) => {
                const status = items[key];
                return (
                  <div key={key} className="flex items-center justify-between gap-3 py-3 first:pt-0">
                    <span className="flex items-center gap-2 text-sm">
                      {status === 'COMPLETE' ? (
                        <CheckCircle2 className="h-5 w-5 text-success" aria-hidden />
                      ) : status === 'OPTIONAL' ? (
                        <MinusCircle className="h-5 w-5 text-muted-foreground" aria-hidden />
                      ) : (
                        <Circle className="h-5 w-5 text-warning" aria-hidden />
                      )}
                      {t(labelKey)}
                    </span>
                    <span className={cn('text-xs font-medium', status === 'INCOMPLETE' && 'text-warning')}>
                      {status === 'COMPLETE' ? t('checkComplete') : status === 'OPTIONAL' ? t('checkNotIncluded') : t('checkActionRequired')}
                    </span>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            <Summary title={t('willBePublic')} items={PUBLIC_ITEMS.map((k) => t(k))} tone="public" />
            <Summary title={t('willStayPrivate')} items={PRIVATE_ITEMS.map((k) => t(k))} tone="private" />
          </div>

          <Alert>
            <p className="text-sm">{eligible ? t('checklistComplete') : t('checklistIncomplete')}</p>
          </Alert>

          <div className="flex flex-wrap gap-3">
            <Button onClick={() => setShowConfirm(true)} disabled={!eligible}>{t('continueConfirm')}</Button>
            <Button asChild variant="outline"><Link href={`/sell/listings/${listingId}/preview`}>{t('preview')}</Link></Button>
          </div>
        </>
      ) : (
        <>
          <Alert>
            <p className="font-medium">{t('simTitle')}</p>
            <p className="text-sm text-muted-foreground">{t('simBody')}</p>
          </Alert>

          <header>
            <h1 className="font-display text-3xl font-semibold">{t('confirmTitle')}</h1>
            <p className="mt-2 text-muted-foreground">{t('confirmBody')}</p>
          </header>

          <Card>
            <CardContent className="space-y-3 pt-6 text-sm">
              <p>{t('confirmPrivacy')}</p>
              <ul className="list-disc space-y-1 ps-5 text-muted-foreground">
                <li>{t('confirmBullet1')}</li>
                <li>{t('confirmBullet2')}</li>
                <li>{t('confirmBullet3')}</li>
                <li>{t('confirmBullet4')}</li>
              </ul>
            </CardContent>
          </Card>

          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={confirmed}
              onChange={(e) => { setConfirmed(e.target.checked); setCheckboxError(false); }}
            />
            <span>{t('checkbox')}</span>
          </label>
          {checkboxError && <p className="text-sm text-destructive" role="alert">{t('checkboxError')}</p>}

          <div className="flex flex-wrap gap-3">
            <Button onClick={onSubmit} loading={submit.isPending}>{t('submit')}</Button>
            <Button variant="outline" onClick={() => setShowConfirm(false)}>{t('backToPreview')}</Button>
          </div>
        </>
      )}
    </div>
  );
}

function Summary({ title, items, tone }: { title: string; items: string[]; tone: 'public' | 'private' }) {
  return (
    <div className={cn('rounded-md border p-4', tone === 'private' && 'bg-muted/40')}>
      <p className="text-sm font-semibold">{title}</p>
      <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
        {items.map((i) => <li key={i}>{i}</li>)}
      </ul>
    </div>
  );
}
