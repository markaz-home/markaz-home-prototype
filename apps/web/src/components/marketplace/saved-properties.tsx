'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Card, CardContent, EmptyState, ErrorState, Skeleton, toast } from '@markaz/ui';
import { Link } from '@/i18n/navigation';
import { trpc } from '@/trpc/react';
import { PropertyCard } from './property-card';

export function SavedProperties() {
  const t = useTranslations('saved');
  const ts = useTranslations('save');
  const list = trpc.marketplace.saved.list.useQuery(undefined, { staleTime: 0 });
  const utils = trpc.useUtils();
  const remove = trpc.marketplace.saved.removeById.useMutation();
  const [announce, setAnnounce] = useState('');

  async function removeSaved(savedId: string) {
    try {
      await remove.mutateAsync({ savedId });
      setAnnounce(ts('removed'));
      await utils.marketplace.saved.list.invalidate();
      await utils.marketplace.saved.publicIds.invalidate().catch(() => {});
    } catch {
      toast(t('removeError'));
    }
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold">{t('title')}</h1>
      <p className="text-muted-foreground mt-2">{t('description')}</p>

      <div className="mt-6">
        {list.isLoading ? (
          <Grid>
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[4/3] w-full rounded-lg" />
            ))}
          </Grid>
        ) : list.isError ? (
          <ErrorState
            title={t('partialError')}
            retryLabel={ts('error')}
            onRetry={() => list.refetch()}
          />
        ) : !list.data || list.data.length === 0 ? (
          <EmptyState
            title={t('emptyTitle')}
            description={t('emptyBody')}
            action={
              <Button asChild>
                <Link href="/properties">{t('browse')}</Link>
              </Button>
            }
          />
        ) : (
          <Grid>
            {list.data.map((item) =>
              item.kind === 'available' ? (
                <PropertyCard key={item.savedId} card={item.card} isAuthenticated saved />
              ) : (
                <Card key={item.savedId} className="flex flex-col justify-between">
                  <CardContent className="space-y-2 pt-6">
                    <p className="font-medium">{t('unavailableTitle')}</p>
                    <p className="text-muted-foreground text-sm">{t('unavailableBody')}</p>
                    <p className="text-muted-foreground text-xs">
                      {t('savedOn', { date: new Date(item.savedAt).toLocaleDateString() })}
                    </p>
                  </CardContent>
                  <div className="p-4 pt-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeSaved(item.savedId)}
                      disabled={remove.isPending}
                    >
                      {ts('remove')}
                    </Button>
                  </div>
                </Card>
              ),
            )}
          </Grid>
        )}
      </div>

      <span role="status" aria-live="polite" className="sr-only">
        {announce}
      </span>
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}
