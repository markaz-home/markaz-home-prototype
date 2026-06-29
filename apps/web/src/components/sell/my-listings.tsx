'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Home, Plus, MoreVertical } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  EmptyState,
  ErrorState,
  Badge,
  Spinner,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@markaz/ui';
import { createSupabaseBrowserClient } from '@markaz/auth/browser';
import { useRouter } from '@/i18n/navigation';
import { trpc } from '@/trpc/react';
import { WIZARD_STEP_CONFIG } from './wizard';
import { OWNERSHIP_BUCKET, DRAFT_PHOTO_BUCKET, removeObjects } from '@/lib/listing-storage';

function nextStepLabel(t: (k: string) => string, next: string): string {
  const cfg = WIZARD_STEP_CONFIG.find((s) => s.key === next);
  return cfg ? t(cfg.labelKey) : t('stepReview');
}

export function MyListings() {
  const t = useTranslations('listing');
  const tpub = useTranslations('publication');
  const router = useRouter();
  const utils = trpc.useUtils();
  const list = trpc.listing.list.useQuery();
  const create = trpc.listing.create.useMutation({
    onSuccess: ({ listingId }) => router.push(`/sell/listings/${listingId}/details`),
  });
  const [toDelete, setToDelete] = useState<string | null>(null);
  const del = trpc.listing.delete.useMutation({
    onSuccess: async (res) => {
      const supabase = createSupabaseBrowserClient();
      await removeObjects(supabase, OWNERSHIP_BUCKET, res.removedDocuments).catch(() => {});
      await removeObjects(supabase, DRAFT_PHOTO_BUCKET, res.removedPhotos).catch(() => {});
      setToDelete(null);
      await utils.listing.list.invalidate();
    },
  });

  if (list.isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }
  if (list.error) {
    return <ErrorState title={t('unavailableTitle')} description={t('unavailableBody')} retryLabel={t('continue')} onRetry={() => list.refetch()} />;
  }

  const items = list.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight text-brand-900">{t('myTitle')}</h1>
          <p className="mt-1 text-muted-foreground">{t('myDescription')}</p>
        </div>
        {items.length > 0 ? (
          <Button onClick={() => create.mutate()} loading={create.isPending}>
            <Plus className="me-1.5 h-4 w-4" aria-hidden /> {t('createNew')}
          </Button>
        ) : null}
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={<Home className="h-8 w-8 text-primary" aria-hidden />}
          title={t('emptyTitle')}
          description={t('emptyBody')}
          action={
            <div className="space-y-2 text-center">
              <Button onClick={() => create.mutate()} loading={create.isPending}>
                <Plus className="me-1.5 h-4 w-4" aria-hidden /> {t('createNew')}
              </Button>
              <p className="text-xs text-muted-foreground">{t('emptySupporting')}</p>
            </div>
          }
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {items.map((l) => (
            <li key={l.id as string}>
              <Card>
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-brand-900">{(l.title as string) || t('untitled')}</p>
                      {l.community ? <p className="truncate text-sm text-muted-foreground">{l.community as string}</p> : null}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger aria-label="More actions" className="rounded p-1 hover:bg-muted">
                        <MoreVertical className="h-4 w-4" aria-hidden />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => router.push(`/sell/listings/${l.id}/preview`)}>{t('previewDraft')}</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setToDelete(l.id as string)}>{t('deleteDraft')}</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <Badge variant={l.ready ? 'success' : 'outline'}>
                    {t(`stateLabel.${l.state as string}` as never)}
                  </Badge>
                  <p className="text-sm text-muted-foreground">
                    {t('sectionsProgress', { done: l.completedRequired as number, total: l.totalRequired as number })}
                  </p>
                  {l.state === 'LIVE' || l.state === 'PAUSED' ? (
                    <p className="text-sm font-medium text-muted-foreground">{t(`stateLabel.${l.state as string}` as never)}</p>
                  ) : !l.ready ? (
                    <p className="text-sm">{t('nextAction', { step: nextStepLabel(t, l.nextStep as string) })}</p>
                  ) : (
                    <p className="text-sm font-medium text-success">{t('stateLabel.READY_TO_PUBLISH')}</p>
                  )}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {l.state === 'LIVE' || l.state === 'PAUSED' ? (
                      <Button variant="outline" size="sm" onClick={() => router.push(`/sell/listings/${l.id}/manage`)}>
                        {tpub('manage')}
                      </Button>
                    ) : l.ready ? (
                      <>
                        <Button size="sm" onClick={() => router.push(`/sell/listings/${l.id}/publish`)}>
                          {tpub('publish')}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => router.push(`/sell/listings/${l.id}`)}>
                          {t('edit')}
                        </Button>
                      </>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => router.push(`/sell/listings/${l.id}`)}>
                        {t('continue')}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('deleteTitle')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t('deleteBody')}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToDelete(null)}>{t('deleteCancel')}</Button>
            <Button variant="destructive" loading={del.isPending} onClick={() => toDelete && del.mutate({ listingId: toDelete })}>
              {t('deleteConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
