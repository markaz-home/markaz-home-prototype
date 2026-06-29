'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  Alert, Badge, Button, Card, CardContent, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
  Skeleton, toast,
} from '@markaz/ui';
import { Link, useRouter } from '@/i18n/navigation';
import { trpc } from '@/trpc/react';
import { formatAed } from '@/lib/format';

type DialogKind = null | 'pause' | 'resume' | 'material';

export function ManageListing({ listingId }: { listingId: string }) {
  const t = useTranslations('publication');
  const tp = useTranslations('property');
  const tPause = useTranslations('pause');
  const tResume = useTranslations('resume');
  const locale = useLocale();
  const router = useRouter();

  const manage = trpc.listing.manage.useQuery({ listingId }, { staleTime: 0 });
  const utils = trpc.useUtils();
  const pause = trpc.listing.pause.useMutation();
  const resume = trpc.listing.resume.useMutation();
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [resumeError, setResumeError] = useState(false);

  if (manage.isLoading) return <Skeleton className="h-80 w-full" />;
  if (manage.isError || !manage.data) return <Alert variant="destructive">{t('processingErrorBody')}</Alert>;
  const d = manage.data;
  const isLive = d.state === 'LIVE';
  const isPaused = d.state === 'PAUSED';
  const publicHref = d.publicId ? `/properties/${d.publicId}/${d.slug ?? ''}` : null;

  async function copyLink() {
    if (!publicHref) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/${locale}${publicHref}`);
      toast(tp('linkCopied'));
    } catch {
      toast(tp('copyFailed'));
    }
  }

  async function doPause() {
    try {
      await pause.mutateAsync({ listingId });
      await utils.listing.manage.invalidate({ listingId });
      setDialog(null);
    } catch {
      toast(tPause('error'));
    }
  }
  async function doResume() {
    setResumeError(false);
    try {
      await resume.mutateAsync({ listingId });
      await utils.listing.manage.invalidate({ listingId });
      setDialog(null);
    } catch {
      setResumeError(true);
    }
  }
  async function doPauseAndEdit() {
    try {
      await pause.mutateAsync({ listingId });
      router.push(`/sell/listings/${listingId}`);
    } catch {
      toast(tPause('error'));
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link href="/sell" className="hover:text-foreground">{t('returnToListings')}</Link>
      </nav>

      <div className="flex items-center gap-3">
        <Badge variant={isLive ? 'success' : 'warning'}>{isLive ? t('liveStatus') : tPause('status')}</Badge>
      </div>

      <header>
        <h1 className="font-display text-2xl font-semibold">{isPaused ? tPause('pageTitle') : d.headline}</h1>
        {isPaused ? (
          <p className="mt-2 text-muted-foreground">{tPause('pageBody')}</p>
        ) : (
          <p className="mt-1 text-muted-foreground">{d.headline}</p>
        )}
        <p className="mt-2 text-xl font-medium">{formatAed(d.askingPriceAed, locale)}</p>
      </header>

      <Card>
        <CardContent className="space-y-1 pt-6 text-sm text-muted-foreground">
          {d.publishedAt && <p>{t('publishedOn', { date: new Date(d.publishedAt).toLocaleDateString() })}</p>}
          <p>{d.savedCount === 0 ? t('noSavesYet') : d.savedCount === 1 ? t('savedByOne') : t('savedByMany', { count: d.savedCount })}</p>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        {isLive && publicHref && <Button asChild><Link href={publicHref}>{t('viewLive')}</Link></Button>}
        {isLive && <Button variant="outline" onClick={copyLink}>{tp('copyLink')}</Button>}
        {isPaused ? (
          <Button onClick={() => setDialog('resume')}>{tResume('action')}</Button>
        ) : (
          <Button variant="outline" onClick={() => setDialog('pause')}>{tPause('action')}</Button>
        )}
        <Button variant="outline" onClick={() => setDialog('material')}>{t('editListing')}</Button>
        <Button asChild variant="ghost"><Link href="/sell">{t('returnToListings')}</Link></Button>
      </div>

      {/* Pause confirmation */}
      <Dialog open={dialog === 'pause'} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{tPause('title')}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{tPause('body')}</p>
          <ul className="list-disc space-y-1 ps-5 text-sm text-muted-foreground">
            <li>{tPause('bullet1')}</li><li>{tPause('bullet2')}</li><li>{tPause('bullet3')}</li>
          </ul>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialog(null)}>{tPause('keepLive')}</Button>
            <Button onClick={doPause} loading={pause.isPending}>{tPause('action')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resume confirmation */}
      <Dialog open={dialog === 'resume'} onOpenChange={(o) => { if (!o) { setDialog(null); setResumeError(false); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{tResume('title')}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{tResume('body')}</p>
          {resumeError && <Alert variant="destructive"><p className="text-sm">{tResume('reviewRequired')}</p></Alert>}
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setDialog(null); setResumeError(false); }}>{tResume('keepPaused')}</Button>
            {resumeError ? (
              <Button asChild><Link href={`/sell/listings/${listingId}/publish`}>{tResume('submitForReview')}</Link></Button>
            ) : (
              <Button onClick={doResume} loading={resume.isPending}>{tResume('action')}</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Material edit interception */}
      <Dialog open={dialog === 'material'} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('materialTitle')}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{t('materialBody')}</p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialog(null)}>{t('materialCancel')}</Button>
            <Button onClick={doPauseAndEdit} loading={pause.isPending}>{t('materialPauseEdit')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
