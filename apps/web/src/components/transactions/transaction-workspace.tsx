'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Alert, Badge, Button, Card, CardContent, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Skeleton } from '@markaz/ui';
import { CANCELLATION_REASONS, PURCHASE_ROUTES, TRANSACTION_STAGES, isTerminal } from '@markaz/domain';
import { useTransactionChannel } from '@markaz/realtime';
import { Link } from '@/i18n/navigation';
import { trpc } from '@/trpc/react';
import type { RouterOutputs } from '@/trpc/types';
import { formatAed } from '@/lib/format';
import { SimulationDisclosure } from './shared';
import { DocumentChecklist } from './document-checklist';

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
        <p className="text-sm text-muted-foreground">{t('unavailable.body')}</p>
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
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
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
        <p className="text-sm text-muted-foreground">
          {[d.property?.community, d.property?.emirate].filter(Boolean).join(' · ')} ·{' '}
          <span dir="ltr">{formatAed(d.acceptedAmountAed)}</span>
        </p>
      </header>

      <SimulationDisclosure />
      <ProgressTracker stageIndex={d.stageIndex} />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <div id="tx-actions" className="space-y-6 scroll-mt-20">
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

/** Mobile sticky action bar — shown only when this participant has a clear action
 * (spec §17.3 / §37). Surfaces the next action and jumps to the action panel; it never
 * covers the final task/timeline event because the workspace adds bottom padding on mobile. */
function MobileActionBar({ d }: { d: Detail }) {
  const t = useTranslations('transactions');
  const mineNow =
    d.nextActor === 'BOTH' ||
    (d.perspective === 'BUYER' && d.nextActor === 'BUYER') ||
    (d.perspective === 'SELLER' && d.nextActor === 'SELLER');
  if (!mineNow) return null;
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden"
      role="region"
      aria-label={t('nextActor.you')}
    >
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
        <p className="min-w-0 truncate text-sm font-medium">{t('nextActor.you')}</p>
        <a
          href="#tx-actions"
          className="inline-flex h-12 shrink-0 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
        >
          {t('goToAction')}
        </a>
      </div>
    </div>
  );
}

function ProgressTracker({ stageIndex }: { stageIndex: number }) {
  const t = useTranslations('transactions.stage');
  return (
    <ol className="flex flex-wrap gap-2" aria-label="progress">
      {TRANSACTION_STAGES.map((s, i) => {
        const state = i < stageIndex ? 'done' : i === stageIndex ? 'current' : 'todo';
        return (
          <li
            key={s}
            aria-current={state === 'current' ? 'step' : undefined}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              state === 'done'
                ? 'bg-primary/15 text-primary'
                : state === 'current'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
            }`}
          >
            {i + 1}. {t(s)}
          </li>
        );
      })}
    </ol>
  );
}

function TaskList({ d }: { d: Detail }) {
  const t = useTranslations('transactions');
  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <h2 className="font-semibold">{t('status.confirmation')}</h2>
        <ul className="divide-y">
          {d.tasks.map((task) => (
            <li key={task.code} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span dir="auto">{t(`taskLabel.${task.code}` as 'taskLabel.BUYER_CONFIRM_DETAILS')}</span>
              <Badge variant={task.status === 'COMPLETED_DEMO' ? 'outline' : 'default'}>
                {t(task.ownershipKey)}
              </Badge>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function Timeline({ d }: { d: Detail }) {
  const t = useTranslations('transactions');
  const format = useFormatterSafe();
  if (d.timeline.length === 0) return null;
  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <h2 className="font-semibold">{t('timeline.title')}</h2>
        <ol className="space-y-3">
          {d.timeline.map((e, i) => (
            <li key={i} className="text-sm">
              <p dir="auto">{t(`timeline.${e.type}` as 'timeline.TRANSACTION_CREATED')}</p>
              <time dateTime={e.createdAt} dir="ltr" className="text-xs text-muted-foreground">
                {format(e.createdAt)}
              </time>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

function useFormatterSafe() {
  return (iso: string) => new Date(iso).toISOString().slice(0, 16).replace('T', ' ');
}

/** Renders the correct action control(s) for the caller's current actionable tasks. */
function NextActionPanel({ d, refresh }: { d: Detail; refresh: () => void }) {
  const t = useTranslations('transactions');
  const v = d.version;
  const opts = { onSuccess: refresh };
  const confirmDetails = trpc.transactions.confirmDetails.useMutation(opts);
  const selectRoute = trpc.transactions.selectRoute.useMutation(opts);
  const setFinancing = trpc.transactions.setFinancing.useMutation(opts);
  const confirmDeposit = trpc.transactions.confirmDeposit.useMutation(opts);
  const markDocs = trpc.transactions.markDocumentsComplete.useMutation(opts);
  const reviewSummary = trpc.transactions.reviewSummary.useMutation(opts);
  const runChecks = trpc.transactions.runDueDiligence.useMutation(opts);
  const proposeDate = trpc.transactions.proposeTransferDate.useMutation(opts);
  const confirmReadiness = trpc.transactions.confirmReadiness.useMutation(opts);
  const createAppt = trpc.transactions.createAppointment.useMutation(opts);
  const confirmCompletion = trpc.transactions.confirmCompletion.useMutation(opts);

  const [ack, setAck] = useState(false);
  const [route, setRoute] = useState<'CASH' | 'FINANCING'>('CASH');
  const [date, setDate] = useState('');

  const my = (code: string) => d.tasks.find((x) => x.code === code && x.mine && x.status === 'ACTION_REQUIRED');
  const sys = (code: string) => d.tasks.find((x) => x.code === code && x.actor === 'SYSTEM' && x.status === 'ACTION_REQUIRED');

  const controls: React.ReactNode[] = [];

  if (d.status === 'CANCELLATION_PENDING') {
    return <CancellationPending d={d} refresh={refresh} />;
  }

  // Confirmation
  if (my('BUYER_CONFIRM_DETAILS') || my('SELLER_CONFIRM_DETAILS')) {
    controls.push(
      <ActionCard key="details" title={t('details.title')}>
        <Ack checked={ack} onChange={setAck} label={t('details.confirm')} />
        <Button disabled={!ack} loading={confirmDetails.isPending} onClick={() => confirmDetails.mutate({ transactionId: d.id, expectedVersion: v })}>
          {t('details.action')}
        </Button>
      </ActionCard>,
    );
  }
  if (my('BUYER_SELECT_ROUTE')) {
    controls.push(
      <ActionCard key="route" title={t('route.title')}>
        <p className="text-sm text-muted-foreground">{t('route.help')}</p>
        <fieldset className="flex gap-2">
          {PURCHASE_ROUTES.map((r) => (
            <label key={r} className={`cursor-pointer rounded-md border px-3 py-2 text-sm ${route === r ? 'border-primary bg-primary/10' : ''}`}>
              <input type="radio" name="route" className="sr-only" checked={route === r} onChange={() => setRoute(r)} />
              {t(`route.${r === 'CASH' ? 'cash' : 'financing'}`)}
            </label>
          ))}
        </fieldset>
        <Button loading={selectRoute.isPending} onClick={() => selectRoute.mutate({ transactionId: d.id, expectedVersion: v, route })}>
          {t('route.select')}
        </Button>
      </ActionCard>,
    );
  }

  // Deposit
  if (my('BUYER_CONFIRM_DEPOSIT')) {
    controls.push(
      <ActionCard key="deposit" title={t('deposit.title')}>
        <p className="text-sm text-muted-foreground">{t('deposit.body')}</p>
        <p className="text-lg font-semibold" dir="ltr">
          {formatAed(d.depositAmountAed)}
        </p>
        <Ack checked={ack} onChange={setAck} label={t('deposit.confirm')} />
        <Button disabled={!ack} loading={confirmDeposit.isPending} onClick={() => confirmDeposit.mutate({ transactionId: d.id, expectedVersion: v })}>
          {t('deposit.action')}
        </Button>
      </ActionCard>,
    );
  }

  // Documents
  if (my('BUYER_FINANCING')) {
    controls.push(
      <ActionCard key="fin" title={t('financing.title')}>
        <p className="text-sm text-muted-foreground">{t('financing.disclosure')}</p>
        <Button loading={setFinancing.isPending} onClick={() => setFinancing.mutate({ transactionId: d.id, expectedVersion: v, status: 'CONFIRMED_DEMO' })}>
          {t('financing.confirm')}
        </Button>
      </ActionCard>,
    );
  }
  if (my('BUYER_DOCUMENTS') || my('SELLER_DOCUMENTS')) {
    controls.push(
      <ActionCard key="docs" title={t('documents.title')}>
        <DocumentChecklist
          transactionId={d.id}
          perspective={d.perspective}
          ownDocuments={d.ownDocuments}
          refresh={refresh}
        />
        <Button loading={markDocs.isPending} onClick={() => markDocs.mutate({ transactionId: d.id, expectedVersion: v })}>
          {t('documents.markComplete')}
        </Button>
      </ActionCard>,
    );
  }
  if (my('BUYER_REVIEW_SUMMARY') || my('SELLER_REVIEW_SUMMARY')) {
    controls.push(
      <ActionCard key="summary" title={t('documents.summaryTitle')}>
        <p className="text-sm text-muted-foreground">{t('documents.summaryDisclosure')}</p>
        <Button loading={reviewSummary.isPending} onClick={() => reviewSummary.mutate({ transactionId: d.id, expectedVersion: v })}>
          {t('documents.reviewSummary')}
        </Button>
      </ActionCard>,
    );
  }

  // Due diligence (system, either participant triggers)
  if (sys('DUE_DILIGENCE')) {
    controls.push(
      <ActionCard key="checks" title={t('checks.title')}>
        <p className="text-sm text-muted-foreground">{t('checks.disclosure')}</p>
        <Button loading={runChecks.isPending} onClick={() => runChecks.mutate({ transactionId: d.id, expectedVersion: v })}>
          {t('checks.run')}
        </Button>
      </ActionCard>,
    );
  }

  // Transfer
  if (my('SELLER_PROPOSE_DATE')) {
    controls.push(
      <ActionCard key="date" title={t('transfer.proposeDate')}>
        <p className="text-sm text-muted-foreground">{t('transfer.proposeHelp')}</p>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-11 rounded-md border px-3" aria-label={t('transfer.proposeDate')} />
        <Button disabled={!date} loading={proposeDate.isPending} onClick={() => proposeDate.mutate({ transactionId: d.id, expectedVersion: v, date })}>
          {t('transfer.propose')}
        </Button>
      </ActionCard>,
    );
  }
  if (my('BUYER_CONFIRM_READINESS') || my('SELLER_CONFIRM_READINESS')) {
    controls.push(
      <ActionCard key="ready" title={t('transfer.title')}>
        <p className="text-sm text-muted-foreground">{d.perspective === 'BUYER' ? t('transfer.buyerReady') : t('transfer.sellerReady')}</p>
        <Button loading={confirmReadiness.isPending} onClick={() => confirmReadiness.mutate({ transactionId: d.id, expectedVersion: v })}>
          {t('transfer.confirmReady')}
        </Button>
      </ActionCard>,
    );
  }
  if (sys('TRANSFER_APPOINTMENT')) {
    controls.push(
      <ActionCard key="appt" title={t('transfer.title')}>
        <Button loading={createAppt.isPending} onClick={() => createAppt.mutate({ transactionId: d.id, expectedVersion: v })}>
          {t('transfer.createAppointment')}
        </Button>
      </ActionCard>,
    );
  }

  // Completion
  if (my('BUYER_CONFIRM_COMPLETION') || my('SELLER_CONFIRM_COMPLETION')) {
    controls.push(
      <ActionCard key="complete" title={t('completion.title')}>
        <Ack checked={ack} onChange={setAck} label={t('completion.confirm')} />
        <Button disabled={!ack} loading={confirmCompletion.isPending} onClick={() => confirmCompletion.mutate({ transactionId: d.id, expectedVersion: v })}>
          {t('completion.action')}
        </Button>
      </ActionCard>,
    );
  }

  if (controls.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground" role="status">
          {t(d.nextActorKey)}
        </CardContent>
      </Card>
    );
  }
  return <>{controls}</>;
}

function ActionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <h2 className="font-semibold">{title}</h2>
        {children}
      </CardContent>
    </Card>
  );
}

function Ack({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1" />
      <span>{label}</span>
    </label>
  );
}

function TerminalPanel({ d }: { d: Detail }) {
  const t = useTranslations('transactions');
  if (d.status === 'COMPLETED_DEMO') {
    return (
      <Card>
        <CardContent className="space-y-2 pt-6">
          <h2 className="text-lg font-semibold">{t('completion.successTitle')}</h2>
          <p className="text-sm text-muted-foreground">{t('completion.successBody')}</p>
        </CardContent>
      </Card>
    );
  }
  if (d.status === 'CANCELLED') {
    return (
      <Card>
        <CardContent className="space-y-3 pt-6">
          <h2 className="text-lg font-semibold">{t('cancellation.cancelledTitle')}</h2>
          <p className="text-sm text-muted-foreground">{t('cancellation.cancelledBody')}</p>
          {d.perspective === 'SELLER' && d.property?.publicId ? (
            <Button asChild variant="outline">
              <Link href={`/sell/listings`}>{t('cancellation.reviewListing')}</Link>
            </Button>
          ) : null}
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardContent className="pt-6">
        <h2 className="text-lg font-semibold">{t('status.failed')}</h2>
      </CardContent>
    </Card>
  );
}

function CancellationPending({ d, refresh }: { d: Detail; refresh: () => void }) {
  const t = useTranslations('transactions');
  const resolve = trpc.transactions.resolveCancellation.useMutation({ onSuccess: refresh });
  const iRequested = d.cancellation?.requestedBySide === d.perspective;
  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <h2 className="font-semibold">{t('cancellation.pendingTitle')}</h2>
        <p className="text-sm text-muted-foreground">{t('cancellation.pendingBody')}</p>
        {!iRequested ? (
          <div className="flex gap-2">
            <Button loading={resolve.isPending} onClick={() => resolve.mutate({ transactionId: d.id, expectedVersion: d.version, confirm: true })}>
              {t('cancellation.confirm')}
            </Button>
            <Button variant="outline" onClick={() => resolve.mutate({ transactionId: d.id, expectedVersion: d.version, confirm: false })}>
              {t('cancellation.decline')}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function CancellationControl({ d, refresh }: { d: Detail; refresh: () => void }) {
  const t = useTranslations('transactions');
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof CANCELLATION_REASONS)[number]>('BUYER_UNABLE');
  const request = trpc.transactions.requestCancellation.useMutation({
    onSuccess: () => {
      setOpen(false);
      refresh();
    },
  });
  if (d.status === 'CANCELLATION_PENDING') return null;
  return (
    <>
      <Button variant="ghost" className="w-full text-destructive" onClick={() => setOpen(true)}>
        {t('cancellation.request')}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('cancellation.requestTitle')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t('cancellation.requestBody')}</p>
          <label className="text-sm">
            {t('cancellation.reasonLabel')}
            <select value={reason} onChange={(e) => setReason(e.target.value as typeof reason)} className="mt-1 h-11 w-full rounded-md border px-3">
              {CANCELLATION_REASONS.map((r) => (
                <option key={r} value={r}>
                  {t(`cancellation.reason.${r}` as 'cancellation.reason.OTHER')}
                </option>
              ))}
            </select>
          </label>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t('cancellation.keep')}
            </Button>
            <Button loading={request.isPending} onClick={() => request.mutate({ transactionId: d.id, expectedVersion: d.version, reason })}>
              {t('cancellation.request')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
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
