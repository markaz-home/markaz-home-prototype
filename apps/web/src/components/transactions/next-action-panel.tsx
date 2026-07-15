'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Card, CardContent } from '@markaz/ui';
import { PURCHASE_ROUTES } from '@markaz/domain';
import { trpc } from '@/trpc/react';
import type { RouterOutputs } from '@/trpc/types';
import { formatAed } from '@/lib/format';
import { DocumentChecklist } from './document-checklist';
import { CancellationPending } from './cancellation-panels';

type Detail = RouterOutputs['transactions']['get'];

/** Renders the correct action control(s) for the caller's current actionable tasks. */
export function NextActionPanel({ d, refresh }: { d: Detail; refresh: () => void }) {
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

  const my = (code: string) =>
    d.tasks.find((x) => x.code === code && x.mine && x.status === 'ACTION_REQUIRED');
  const sys = (code: string) =>
    d.tasks.find((x) => x.code === code && x.actor === 'SYSTEM' && x.status === 'ACTION_REQUIRED');

  const controls: React.ReactNode[] = [];

  if (d.status === 'CANCELLATION_PENDING') {
    return <CancellationPending d={d} refresh={refresh} />;
  }

  // Confirmation
  if (my('BUYER_CONFIRM_DETAILS') || my('SELLER_CONFIRM_DETAILS')) {
    controls.push(
      <ActionCard key="details" title={t('details.title')}>
        <Ack checked={ack} onChange={setAck} label={t('details.confirm')} />
        <Button
          disabled={!ack}
          loading={confirmDetails.isPending}
          onClick={() => confirmDetails.mutate({ transactionId: d.id, expectedVersion: v })}
        >
          {t('details.action')}
        </Button>
      </ActionCard>,
    );
  }
  if (my('BUYER_SELECT_ROUTE')) {
    controls.push(
      <ActionCard key="route" title={t('route.title')}>
        <p className="text-muted-foreground text-sm">{t('route.help')}</p>
        <fieldset className="flex gap-2">
          {PURCHASE_ROUTES.map((r) => (
            <label
              key={r}
              className={`cursor-pointer rounded-md border px-3 py-2 text-sm ${route === r ? 'border-primary bg-primary/10' : ''}`}
            >
              <input
                type="radio"
                name="route"
                className="sr-only"
                checked={route === r}
                onChange={() => setRoute(r)}
              />
              {t(`route.${r === 'CASH' ? 'cash' : 'financing'}`)}
            </label>
          ))}
        </fieldset>
        <Button
          loading={selectRoute.isPending}
          onClick={() => selectRoute.mutate({ transactionId: d.id, expectedVersion: v, route })}
        >
          {t('route.select')}
        </Button>
      </ActionCard>,
    );
  }

  // Deposit
  if (my('BUYER_CONFIRM_DEPOSIT')) {
    controls.push(
      <ActionCard key="deposit" title={t('deposit.title')}>
        <p className="text-muted-foreground text-sm">{t('deposit.body')}</p>
        <p className="text-lg font-semibold" dir="ltr">
          {formatAed(d.depositAmountAed)}
        </p>
        <Ack checked={ack} onChange={setAck} label={t('deposit.confirm')} />
        <Button
          disabled={!ack}
          loading={confirmDeposit.isPending}
          onClick={() => confirmDeposit.mutate({ transactionId: d.id, expectedVersion: v })}
        >
          {t('deposit.action')}
        </Button>
      </ActionCard>,
    );
  }

  // Documents
  if (my('BUYER_FINANCING')) {
    controls.push(
      <ActionCard key="fin" title={t('financing.title')}>
        <p className="text-muted-foreground text-sm">{t('financing.disclosure')}</p>
        <Button
          loading={setFinancing.isPending}
          onClick={() =>
            setFinancing.mutate({
              transactionId: d.id,
              expectedVersion: v,
              status: 'CONFIRMED_DEMO',
            })
          }
        >
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
        <Button
          loading={markDocs.isPending}
          onClick={() => markDocs.mutate({ transactionId: d.id, expectedVersion: v })}
        >
          {t('documents.markComplete')}
        </Button>
      </ActionCard>,
    );
  }
  if (my('BUYER_REVIEW_SUMMARY') || my('SELLER_REVIEW_SUMMARY')) {
    controls.push(
      <ActionCard key="summary" title={t('documents.summaryTitle')}>
        <p className="text-muted-foreground text-sm">{t('documents.summaryDisclosure')}</p>
        <Button
          loading={reviewSummary.isPending}
          onClick={() => reviewSummary.mutate({ transactionId: d.id, expectedVersion: v })}
        >
          {t('documents.reviewSummary')}
        </Button>
      </ActionCard>,
    );
  }

  // Due diligence (system, either participant triggers)
  if (sys('DUE_DILIGENCE')) {
    controls.push(
      <ActionCard key="checks" title={t('checks.title')}>
        <p className="text-muted-foreground text-sm">{t('checks.disclosure')}</p>
        <Button
          loading={runChecks.isPending}
          onClick={() => runChecks.mutate({ transactionId: d.id, expectedVersion: v })}
        >
          {t('checks.run')}
        </Button>
      </ActionCard>,
    );
  }

  // Transfer
  if (my('SELLER_PROPOSE_DATE')) {
    controls.push(
      <ActionCard key="date" title={t('transfer.proposeDate')}>
        <p className="text-muted-foreground text-sm">{t('transfer.proposeHelp')}</p>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="h-11 rounded-md border px-3"
          aria-label={t('transfer.proposeDate')}
        />
        <Button
          disabled={!date}
          loading={proposeDate.isPending}
          onClick={() => proposeDate.mutate({ transactionId: d.id, expectedVersion: v, date })}
        >
          {t('transfer.propose')}
        </Button>
      </ActionCard>,
    );
  }
  if (my('BUYER_CONFIRM_READINESS') || my('SELLER_CONFIRM_READINESS')) {
    controls.push(
      <ActionCard key="ready" title={t('transfer.title')}>
        <p className="text-muted-foreground text-sm">
          {d.perspective === 'BUYER' ? t('transfer.buyerReady') : t('transfer.sellerReady')}
        </p>
        <Button
          loading={confirmReadiness.isPending}
          onClick={() => confirmReadiness.mutate({ transactionId: d.id, expectedVersion: v })}
        >
          {t('transfer.confirmReady')}
        </Button>
      </ActionCard>,
    );
  }
  if (sys('TRANSFER_APPOINTMENT')) {
    controls.push(
      <ActionCard key="appt" title={t('transfer.title')}>
        <Button
          loading={createAppt.isPending}
          onClick={() => createAppt.mutate({ transactionId: d.id, expectedVersion: v })}
        >
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
        <Button
          disabled={!ack}
          loading={confirmCompletion.isPending}
          onClick={() => confirmCompletion.mutate({ transactionId: d.id, expectedVersion: v })}
        >
          {t('completion.action')}
        </Button>
      </ActionCard>,
    );
  }

  if (controls.length === 0) {
    return (
      <Card>
        <CardContent className="text-muted-foreground pt-6 text-sm" role="status">
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

function Ack({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1"
      />
      <span>{label}</span>
    </label>
  );
}
