'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Badge, Button, Card, CardContent, EmptyState, ErrorState, Skeleton } from '@markaz/ui';
import { isTerminal } from '@markaz/domain';
import { Link } from '@/i18n/navigation';
import { trpc } from '@/trpc/react';
import type { RouterOutputs } from '@/trpc/types';
import { formatAed } from '@/lib/format';
import { SimulationDisclosure } from './shared';

type Filter = 'all' | 'action' | 'waiting' | 'completed' | 'closed';
const FILTERS: Filter[] = ['all', 'action', 'waiting', 'completed', 'closed'];

export function TransactionsHub() {
  const t = useTranslations('transactions');
  const list = trpc.transactions.listMine.useQuery();
  const anyAction = (list.data ?? []).some((x) => needsAction(x));
  const [filter, setFilter] = useState<Filter>('all');

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>
      <SimulationDisclosure />

      {list.isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-lg" />
          ))}
        </div>
      ) : list.isError ? (
        <ErrorState title={t('loadError.title')} description={t('loadError.body')} />
      ) : !list.data || list.data.length === 0 ? (
        <EmptyState
          title={t('empty.title')}
          description={t('empty.body')}
          action={
            <Button asChild>
              <Link href="/properties">{t('empty.browse')}</Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="flex flex-wrap gap-2" role="group" aria-label={t('title')}>
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
                className={`rounded-full border px-3 py-1 text-sm ${filter === f ? 'border-primary bg-primary/10 font-medium' : 'text-muted-foreground'}`}
              >
                {t(`filters.${f === 'all' && anyAction ? 'all' : f}`)}
              </button>
            ))}
          </div>
          <ul className="space-y-3">
            {list.data.filter((x) => matchesFilter(x, filter)).map((x) => (
              <li key={x.id}>
                <TransactionCard item={x} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

type Item = RouterOutputs['transactions']['listMine'][number];

function needsAction(x: Item): boolean {
  return (
    x.nextActor === 'BOTH' ||
    (x.perspective === 'BUYER' && x.nextActor === 'BUYER') ||
    (x.perspective === 'SELLER' && x.nextActor === 'SELLER')
  );
}
function matchesFilter(x: Item, f: Filter): boolean {
  if (f === 'all') return true;
  if (f === 'completed') return x.status === 'COMPLETED_DEMO';
  if (f === 'closed') return x.status === 'CANCELLED' || x.status === 'FAILED';
  if (f === 'action') return !isTerminal(x.status) && needsAction(x);
  if (f === 'waiting') return !isTerminal(x.status) && !needsAction(x);
  return true;
}

function TransactionCard({ item }: { item: Item }) {
  const t = useTranslations('transactions');
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center">
        {item.property?.coverUrl ? (
          <img src={item.property.coverUrl} alt="" className="h-20 w-28 shrink-0 rounded-md object-cover" />
        ) : (
          <div className="h-20 w-28 shrink-0 rounded-md bg-muted" aria-hidden />
        )}
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{item.perspective === 'BUYER' ? t('buying') : t('selling')}</Badge>
            <Badge>{t(item.statusKey)}</Badge>
          </div>
          <p dir="auto" className="truncate font-medium">
            {item.property?.headline ?? '—'}
          </p>
          <p className="text-sm text-muted-foreground">
            {[item.property?.community, item.property?.emirate].filter(Boolean).join(' · ')}
          </p>
          <p className="text-sm" dir="ltr">
            {formatAed(item.acceptedAmountAed)}
          </p>
          <p className="text-sm text-primary">{t(item.nextActorKey)}</p>
          <p className="text-xs text-muted-foreground">
            {t('progress.stages', { completed: item.completedStages, total: item.totalStages })}
          </p>
        </div>
        <Button asChild className="shrink-0">
          <Link href={`/transactions/${item.id}`}>{t('viewWorkspace')}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
