'use client';

import { useState } from 'react';
import { ArrowLeft, CheckCircle2, Circle, Eye, Lock, MinusCircle } from 'lucide-react';
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

const PUBLIC_ITEMS = [
  'publicPhotos',
  'publicPrice',
  'publicLocation',
  'publicFacts',
  'publicInvestment',
] as const;
const PRIVATE_ITEMS = [
  'privateDocument',
  'privateUnit',
  'privateContact',
  'privateOccupancy',
  'privateVerification',
] as const;

export function PublishFlow({ listingId }: { listingId: string }) {
  const t = useTranslations('publication');
  const router = useRouter();
  const checklist = trpc.listing.publication.checklist.useQuery({ listingId }, { staleTime: 0 });
  const submit = trpc.listing.publication.submit.useMutation();
  const [confirmed, setConfirmed] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [checkboxError, setCheckboxError] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

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
    setSubmitError(null);
    try {
      await submit.mutateAsync({ listingId, confirm: true });
      router.push(`/sell/listings/${listingId}/publication`);
    } catch (e) {
      setSubmitError((e as { message?: string })?.message ?? t('processingErrorBody'));
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <nav aria-label="Breadcrumb" className="text-muted-foreground text-sm">
        <Link href="/sell" className="hover:text-foreground inline-flex items-center gap-1.5">
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden />
          {t('returnToListings')}
        </Link>
      </nav>

      {!showConfirm ? (
        <>
          <header>
            <h1 className="font-display text-3xl font-semibold">{t('checklistTitle')}</h1>
            <p className="text-muted-foreground mt-2">{t('checklistBody')}</p>
          </header>

          <Card>
            <CardContent className="divide-y pt-6">
              {CHECK_ITEMS.map(([key, labelKey]) => {
                const status = items[key];
                return (
                  <div
                    key={key}
                    className="flex items-center justify-between gap-3 py-3 first:pt-0"
                  >
                    <span className="flex items-center gap-2 text-sm">
                      {status === 'COMPLETE' ? (
                        <CheckCircle2 className="text-success h-5 w-5" aria-hidden />
                      ) : status === 'OPTIONAL' ? (
                        <MinusCircle className="text-muted-foreground h-5 w-5" aria-hidden />
                      ) : (
                        <Circle className="text-warning h-5 w-5" aria-hidden />
                      )}
                      {t(labelKey)}
                    </span>
                    <span
                      className={cn(
                        'text-xs font-medium',
                        status === 'INCOMPLETE' && 'text-warning',
                      )}
                    >
                      {status === 'COMPLETE'
                        ? t('checkComplete')
                        : status === 'OPTIONAL'
                          ? t('checkNotIncluded')
                          : t('checkActionRequired')}
                    </span>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            <Summary
              title={t('willBePublic')}
              items={PUBLIC_ITEMS.map((k) => t(k))}
              tone="public"
            />
            <Summary
              title={t('willStayPrivate')}
              items={PRIVATE_ITEMS.map((k) => t(k))}
              tone="private"
            />
          </div>

          <Alert>
            <p className="text-sm">
              {eligible ? t('checklistComplete') : t('checklistIncomplete')}
            </p>
          </Alert>

          <div className="flex flex-wrap gap-3">
            <Button onClick={() => setShowConfirm(true)} disabled={!eligible}>
              {t('continueConfirm')}
            </Button>
            <Button asChild variant="outline">
              <Link href={`/sell/listings/${listingId}/preview`}>{t('preview')}</Link>
            </Button>
          </div>
        </>
      ) : (
        <>
          <Alert>
            <p className="font-medium">{t('simTitle')}</p>
            <p className="text-muted-foreground text-sm">{t('simBody')}</p>
          </Alert>

          <header>
            <h1 className="font-display text-3xl font-semibold">{t('confirmTitle')}</h1>
            <p className="text-muted-foreground mt-2">{t('confirmBody')}</p>
          </header>

          <Card>
            <CardContent className="space-y-3 pt-6 text-sm">
              <p>{t('confirmPrivacy')}</p>
              <ul className="text-muted-foreground mt-3 space-y-2 text-sm">
                {(
                  ['confirmBullet1', 'confirmBullet2', 'confirmBullet3', 'confirmBullet4'] as const
                ).map((key) => (
                  <li key={key} className="flex items-start gap-2.5">
                    <span
                      aria-hidden
                      className="bg-primary mt-[0.45rem] h-1.5 w-1.5 shrink-0 rounded-full"
                    />
                    <span>{t(key)}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={confirmed}
              onChange={(e) => {
                setConfirmed(e.target.checked);
                setCheckboxError(false);
              }}
            />
            <span>{t('checkbox')}</span>
          </label>
          {checkboxError && (
            <p className="text-destructive text-sm" role="alert">
              {t('checkboxError')}
            </p>
          )}
          {submitError && (
            <Alert variant="destructive">
              <p className="text-sm">{submitError}</p>
            </Alert>
          )}

          <div className="flex flex-wrap gap-3">
            <Button onClick={onSubmit} loading={submit.isPending}>
              {t('submit')}
            </Button>
            <Button variant="outline" onClick={() => setShowConfirm(false)}>
              {t('backToPreview')}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function Summary({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: 'public' | 'private';
}) {
  // Each row is marked, so the two lists are scannable and cannot be mistaken
  // for one another: an eye for what buyers see, a lock for what they never do.
  const Marker = tone === 'public' ? Eye : Lock;
  return (
    <div className={cn('rounded-lg border p-4', tone === 'private' && 'bg-muted/40')}>
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Marker
          className={cn('h-4 w-4', tone === 'public' ? 'text-primary' : 'text-muted-foreground')}
          aria-hidden
        />
        {title}
      </p>
      <ul className="text-muted-foreground mt-3 space-y-2 text-sm">
        {items.map((i) => (
          <li key={i} className="flex items-start gap-2.5">
            <span
              aria-hidden
              className={cn(
                'mt-[0.45rem] h-1.5 w-1.5 shrink-0 rounded-full',
                tone === 'public' ? 'bg-primary' : 'bg-muted-foreground/50',
              )}
            />
            <span>{i}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
