'use client';

import { useTranslations } from 'next-intl';
import { Alert, Badge, Button, Card, CardContent, Skeleton } from '@markaz/ui';
import { isTerminal } from '@markaz/domain';
import { useTransactionChannel } from '@markaz/realtime';
import { Link } from '@/i18n/navigation';
import { trpc } from '@/trpc/react';
import type { RouterOutputs } from '@/trpc/types';
import { formatAed } from '@/lib/format';
import { SimulationDisclosure } from './shared';
import { MobileActionBar, ProgressTracker, TaskList, Timeline } from './workspace-panels';
import { NextActionPanel } from './next-action-panel';
import { TerminalPanel, CancellationControl } from './cancellation-panels';

type Detail = RouterOutputs['transactions']['get'];

export function TransactionWorkspace({ transactionId }: { transactionId: string }) {
  const t = useTranslations('transactions');
  const utils = trpc.useUtils();
  const q = trpc.transactions.get.useQuery({ transactionId }, { retry: false });
  const { status: rt } = useTransactionChannel(transactionId, () => {
    void utils.transactions.get.invalidate({ transactionId });
  });

  if (q.isLoading) return <WorkspaceSkeleton />;
  if (q.isError || !q.data) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-12 text-center">
        <h1 className="text-xl font-semibold">{t('unavailable.title')}</h1>
        <p className="text-muted-foreground text-sm">{t('unavailable.body')}</p>
        <Button asChild variant="outline">
          <Link href="/transactions">{t('backToList')}</Link>
        </Button>
      </div>
    );
  }
  return <Loaded d={q.data} rt={rt} />;
}

function Loaded({ d, rt }: { d: Detail; rt: string }) {
  const t = useTranslations('transactions');
  const utils = trpc.useUtils();
  const refresh = () => {
    void utils.transactions.get.invalidate({ transactionId: d.id });
    void utils.transactions.listMine.invalidate();
    void utils.transactions.getActionCounts.invalidate();
  };
  const done = isTerminal(d.status);

  return (
    <div className="space-y-6 pb-24 lg:pb-0">
      <nav aria-label="Breadcrumb" className="text-muted-foreground text-sm">
        <Link href="/transactions" className="hover:underline">
          {t('title')}
        </Link>{' '}
        · <span dir="ltr">{d.reference}</span>
      </nav>

      {rt === 'stale' || rt === 'reconnecting' ? (
        <Alert>
          {t('realtime.reconnecting')}{' '}
          <button type="button" className="underline" onClick={refresh}>
            {t('realtime.refresh')}
          </button>
        </Alert>
      ) : null}

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{d.perspective === 'BUYER' ? t('buying') : t('selling')}</Badge>
          <Badge>{t(d.statusKey)}</Badge>
        </div>
        <h1 dir="auto" className="text-2xl font-semibold tracking-tight">
          {d.property?.headline ?? '—'}
        </h1>
        <p className="text-muted-foreground text-sm">
          {[d.property?.community, d.property?.emirate].filter(Boolean).join(' · ')} ·{' '}
          <span dir="ltr">{formatAed(d.acceptedAmountAed)}</span>
        </p>
      </header>

      <SimulationDisclosure />
      <ProgressTracker stageIndex={d.stageIndex} />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <div id="tx-actions" className="scroll-mt-20 space-y-6">
            {done ? <TerminalPanel d={d} /> : <NextActionPanel d={d} refresh={refresh} />}
          </div>
          <TaskList d={d} />
          <Timeline d={d} />
        </div>
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardContent className="space-y-1 pt-6 text-sm">
              <p className="font-medium" role="status">
                {t(d.nextActorKey)}
              </p>
              <p className="text-muted-foreground">
                {t('progress.stages', { completed: d.completedStages, total: d.totalStages })}
              </p>
            </CardContent>
          </Card>
          {!done ? <CancellationControl d={d} refresh={refresh} /> : null}
        </aside>
      </div>

      {!done ? <MobileActionBar d={d} /> : null}
    </div>
  );
}

function WorkspaceSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-10 w-full" />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    </div>
  );
}
