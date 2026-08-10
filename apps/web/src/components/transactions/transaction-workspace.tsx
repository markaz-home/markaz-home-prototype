'use client';

import { useTranslations } from 'next-intl';
import { ArrowLeft, ArrowRight, CheckCircle2, Clock3, LockKeyhole } from 'lucide-react';
import { Alert, Badge, Button, Skeleton } from '@markaz/ui';
import { TRANSACTION_STAGES, isTerminal, type TransactionStage } from '@markaz/domain';
import { useTransactionChannel } from '@markaz/realtime';
import { Link } from '@/i18n/navigation';
import { trpc } from '@/trpc/react';
import type { RouterOutputs } from '@/trpc/types';
import { formatAed } from '@/lib/format';
import { MobileActionBar, ProgressTracker, StageRail, TaskList, Timeline } from './workspace-panels';
import { NextActionPanel } from './next-action-panel';
import { TerminalPanel, CancellationControl, CancellationPending } from './cancellation-panels';
import { slugForStage, stageFromSlug } from '@/lib/transaction-routes';

type Detail = RouterOutputs['transactions']['get'];

export function TransactionWorkspace({
  transactionId,
  stageSlug = 'confirm',
}: {
  transactionId: string;
  stageSlug?: string;
}) {
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
  const stage = stageFromSlug(stageSlug);
  if (!stage) return <WorkspaceSkeleton />;
  return <Loaded d={q.data} rt={rt} viewedStage={stage} />;
}

function Loaded({ d, rt, viewedStage }: { d: Detail; rt: string; viewedStage: TransactionStage }) {
  const t = useTranslations('transactions');
  const utils = trpc.useUtils();
  const refresh = () => {
    void utils.transactions.get.invalidate({ transactionId: d.id });
    void utils.transactions.listMine.invalidate();
    void utils.transactions.getActionCounts.invalidate();
  };
  const done = isTerminal(d.status);
  const viewedIndex = TRANSACTION_STAGES.indexOf(viewedStage);
  const currentIndex = Math.min(d.stageIndex, TRANSACTION_STAGES.length - 1);
  const futureStage = !done && viewedIndex > currentIndex;
  const completedStage = !done && viewedIndex < currentIndex;
  const mineNow = d.tasks.some(
    (task) => task.stage === viewedStage && task.mine && task.status === 'ACTION_REQUIRED',
  );
  const systemNow = d.tasks.some(
    (task) =>
      task.stage === viewedStage && task.actor === 'SYSTEM' && task.status === 'ACTION_REQUIRED',
  );

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 pb-24 lg:pb-0">
      <nav
        aria-label={t('title')}
        className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-sm"
      >
        <Link href="/transactions" className="inline-flex items-center gap-1.5 hover:underline">
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden />
          {t('title')}
        </Link>
        <span>
          · <span dir="ltr">{d.reference}</span>
        </span>
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

      <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
        <StageRail stageIndex={d.stageIndex} transactionId={d.id} viewedStage={viewedStage} />
        <div className="min-w-0 space-y-4">
          <ProgressTracker stageIndex={d.stageIndex} />
          <section
            id="tx-actions"
            className="platform-gold-panel border-border/70 bg-card/40 scroll-mt-20 rounded-lg border p-6 md:p-7"
          >
            <p className="text-primary mb-6 text-[11px] font-semibold uppercase tracking-[0.18em]">
              {t('stageProgress', {
                current: viewedIndex + 1,
                total: TRANSACTION_STAGES.length,
              })}{' '}
              · {t(`stage.${viewedStage}`)}
            </p>
            {done ? (
              <TerminalPanel d={d} />
            ) : d.status === 'CANCELLATION_PENDING' ? (
              <CancellationPending d={d} refresh={refresh} />
            ) : futureStage ? (
              <StageStateCard
                icon={<LockKeyhole className="h-5 w-5" aria-hidden />}
                title={t('stageLockedTitle')}
                body={t('stageLockedBody')}
              />
            ) : completedStage ? (
              <StageStateCard
                icon={<CheckCircle2 className="h-5 w-5" aria-hidden />}
                title={t('stageCompleteTitle')}
                body={t('stageCompleteBody')}
                action={
                  <Button asChild>
                    <Link
                      href={`/transactions/${d.id}/${slugForStage(TRANSACTION_STAGES[currentIndex]!)}`}
                    >
                      {t('continueCurrentStage')}
                      <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden />
                    </Link>
                  </Button>
                }
              />
            ) : !mineNow && !systemNow ? (
              <WaitingPanel d={d} />
            ) : (
              <NextActionPanel d={d} stage={viewedStage} refresh={refresh} />
            )}
          </section>

          <TaskList d={d} stage={viewedStage} />

          <details className="border-border/70 group rounded-xl border px-4 py-3 sm:px-5">
            <summary className="text-primary flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium underline-offset-4 hover:underline">
              {t('activityToggle')}
              <span className="text-muted-foreground text-xs">{d.timeline.length}</span>
            </summary>
            <div className="mt-4">
              <Timeline d={d} />
            </div>
          </details>

          {!done ? (
            <details className="group border-t pt-2">
              <summary className="text-muted-foreground hover:text-foreground cursor-pointer list-none py-2 text-xs font-medium">
                {t('moreOptions')}
              </summary>
              <CancellationControl d={d} refresh={refresh} />
            </details>
          ) : null}
        </div>
      </div>

      {!done && !futureStage && !completedStage ? <MobileActionBar d={d} /> : null}
    </div>
  );
}

function WaitingPanel({ d }: { d: Detail }) {
  const t = useTranslations('transactions');
  const reminderDue = Date.now() >= new Date(d.reminderAt).getTime();
  const bodyKey =
    d.nextActor === 'SELLER'
      ? 'waiting.seller'
      : d.nextActor === 'BUYER'
        ? 'waiting.buyer'
        : d.nextActor === 'SYSTEM'
          ? 'waiting.system'
          : 'waiting.both';
  return (
    <div className="flex gap-4">
      <span className="border-primary/35 bg-primary/10 text-primary grid h-11 w-11 shrink-0 place-items-center rounded-full border">
        <Clock3 className="h-5 w-5" aria-hidden />
      </span>
      <div>
        <h2 className="font-display text-2xl" role="status">
          {t(d.nextActorKey)}
        </h2>
        <p className="text-muted-foreground mt-1 text-sm leading-6">{t(bodyKey)}</p>
        <p className="text-primary mt-3 text-xs font-medium">
          {t(reminderDue ? 'waiting.reminderDue' : 'waiting.reminder')}
        </p>
      </div>
    </div>
  );
}

function StageStateCard({
  icon,
  title,
  body,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-4">
      <span className="border-primary/30 bg-primary/10 text-primary grid h-10 w-10 shrink-0 place-items-center rounded-full border">
        {icon}
      </span>
      <div className="space-y-3">
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="text-muted-foreground mt-1 text-sm">{body}</p>
        </div>
        {action}
      </div>
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
