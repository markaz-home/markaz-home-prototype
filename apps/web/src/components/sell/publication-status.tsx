'use client';

import { useEffect } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Alert, Badge, Button, Card, CardContent, Skeleton, toast } from '@markaz/ui';
import { Link } from '@/i18n/navigation';
import { trpc } from '@/trpc/react';

const REASON_BY_CATEGORY: Record<string, string> = {
  LISTING_CHANGED: 'reasonChanged',
  PHOTO_PROCESSING_FAILED: 'reasonPhotos',
  CHECKLIST_INCOMPLETE: 'reasonChecklist',
  DEMO_REVIEW_RETURNED: 'reasonReturned',
};

export function PublicationStatus({ listingId }: { listingId: string }) {
  const t = useTranslations('publication');
  const tp = useTranslations('property');
  const locale = useLocale();
  const status = trpc.listing.publication.status.useQuery({ listingId }, { staleTime: 0 });
  const retry = trpc.listing.publication.retry.useMutation();

  // If approved but the LIVE transition hasn't surfaced yet, poll once more.
  const data = status.data;
  useEffect(() => {
    if (data && data.status === 'APPROVED_DEMO' && data.listingState !== 'LIVE') {
      const id = setTimeout(() => status.refetch(), 600);
      return () => clearTimeout(id);
    }
  }, [data, status]);

  if (status.isLoading) return <Skeleton className="h-80 w-full" />;
  if (status.isError || !data)
    return <Alert variant="destructive">{t('processingErrorBody')}</Alert>;

  const publicHref = data.publicId ? `/properties/${data.publicId}/${data.slug ?? ''}` : null;

  async function copyLink() {
    if (!publicHref) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/${locale}${publicHref}`);
      toast(tp('linkCopied'));
    } catch {
      /* clipboard unavailable */
    }
  }

  async function onRetry() {
    await retry.mutateAsync({ listingId });
    await status.refetch();
  }

  // LIVE success
  if (data.listingState === 'LIVE' && data.publicId) {
    return (
      <Wrapper>
        <Badge variant="success">{t('liveStatus')}</Badge>
        <div className="flex items-start gap-3">
          <CheckCircle2 className="text-success mt-1 h-6 w-6" aria-hidden />
          <div>
            <h1 className="font-display text-3xl font-semibold">{t('liveTitle')}</h1>
            <p className="text-muted-foreground mt-2">{t('liveBody')}</p>
            <p className="text-muted-foreground mt-1 text-sm">{t('liveSupporting')}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href={publicHref!}>{t('viewLive')}</Link>
          </Button>
          <Button variant="outline" onClick={copyLink}>
            {tp('copyLink')}
          </Button>
          <Button asChild variant="outline">
            <Link href={`/sell/listings/${listingId}/manage`}>{t('manage')}</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/sell">{t('returnToListings')}</Link>
          </Button>
        </div>
        <Alert>
          <p className="text-muted-foreground text-sm">{t('liveSimNote')}</p>
        </Alert>
      </Wrapper>
    );
  }

  // Returned for changes / failures
  if (data.status === 'REJECTED_DEMO') {
    const cat = data.outcomeCategory ?? 'DEMO_REVIEW_RETURNED';
    if (cat === 'PHOTO_PROCESSING_FAILED') {
      return (
        <Wrapper>
          <Badge variant="warning">{t('returnedChip')}</Badge>
          <h1 className="font-display text-2xl font-semibold">{t('returnedTitle')}</h1>
          <p className="text-muted-foreground">{t('photoFailure')}</p>
          <div className="flex flex-wrap gap-3">
            <Button onClick={onRetry} loading={retry.isPending}>
              {t('retry')}
            </Button>
            <Button asChild variant="outline">
              <Link href={`/sell/listings/${listingId}/photos`}>{t('reviewPhotographs')}</Link>
            </Button>
          </div>
        </Wrapper>
      );
    }
    if (cat === 'PROCESSING_ERROR') {
      return (
        <Wrapper>
          <h1 className="font-display text-2xl font-semibold">{t('processingErrorTitle')}</h1>
          <p className="text-muted-foreground">{t('processingErrorBody')}</p>
          <div className="flex flex-wrap gap-3">
            <Button onClick={onRetry} loading={retry.isPending}>
              {t('retry')}
            </Button>
            <Button asChild variant="ghost">
              <Link href="/sell">{t('returnToListings')}</Link>
            </Button>
          </div>
        </Wrapper>
      );
    }
    const reasonKey = REASON_BY_CATEGORY[cat] ?? 'reasonReturned';
    return (
      <Wrapper>
        <Badge variant="warning">{t('returnedChip')}</Badge>
        <h1 className="font-display text-2xl font-semibold">{t('returnedTitle')}</h1>
        <p className="text-muted-foreground">{t('returnedBody')}</p>
        <Alert>
          <p className="text-sm">{t(reasonKey)}</p>
        </Alert>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href={`/sell/listings/${listingId}`}>{t('reviewListing')}</Link>
          </Button>
          <Button variant="outline" onClick={onRetry} loading={retry.isPending}>
            {t('retry')}
          </Button>
          <Button asChild variant="ghost">
            <Link href="/sell">{t('returnToListings')}</Link>
          </Button>
        </div>
      </Wrapper>
    );
  }

  // Pending / approved-transition
  const approved = data.status === 'APPROVED_DEMO';
  return (
    <Wrapper>
      <Badge variant="outline">{approved ? t('approvedStatus') : t('pendingStatus')}</Badge>
      <div className="flex items-start gap-3">
        <Loader2
          className="text-primary mt-1 h-6 w-6 animate-spin motion-reduce:animate-none"
          aria-hidden
        />
        <div>
          <h1 className="font-display text-2xl font-semibold">
            {approved ? t('approvedTitle') : t('pendingTitle')}
          </h1>
          <p className="text-muted-foreground mt-2">
            {approved ? t('approvedBody') : t('pendingBody')}
          </p>
        </div>
      </div>
      <Card>
        <CardContent className="text-muted-foreground space-y-2 pt-6 text-sm">
          <p>1 · {t('stage1')}</p>
          <p>2 · {t('stage2')}</p>
          <p>3 · {t('stage3')}</p>
        </CardContent>
      </Card>
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" onClick={() => status.refetch()}>
          {t('viewStatus')}
        </Button>
        <Button asChild variant="ghost">
          <Link href="/sell">{t('returnToListings')}</Link>
        </Button>
      </div>
    </Wrapper>
  );
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-3xl space-y-6">{children}</div>;
}
