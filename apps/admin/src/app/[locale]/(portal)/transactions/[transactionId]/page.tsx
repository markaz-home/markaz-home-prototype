import { setRequestLocale, getTranslations } from 'next-intl/server';
import { EmptyState } from '@markaz/ui';
import { getServerApi } from '@/server/api';
import { PageHeader, PageShell } from '@/components/admin/page-header';
import { DataSection, Field, FieldGrid } from '@/components/admin/detail';
import { StatusBadge } from '@/components/admin/status-badge';
import { NotesPanel } from '@/components/admin/notes-panel';
import { DocumentPanel } from '@/components/admin/document-panel';
import {
  PauseTransactionAction,
  ResumeTransactionAction,
  RetryStepAction,
  MarkFailedAction,
  ResolveCancellationAction,
} from '@/components/admin/entity-actions';
import { transactionStatusLabel, formatAed, formatWhen } from '@/components/admin/labels';

const TERMINAL = new Set(['COMPLETED_DEMO', 'CANCELLED', 'FAILED']);

export default async function TransactionDetailPage({
  params,
}: {
  params: Promise<{ locale: string; transactionId: string }>;
}) {
  const { locale, transactionId } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('admin');

  let x: Awaited<
    ReturnType<Awaited<ReturnType<typeof getServerApi>>['admin']['transactions']['get']>
  > | null = null;
  try {
    x = await (await getServerApi()).admin.transactions.get({ id: transactionId });
  } catch {
    x = null;
  }
  if (!x)
    return (
      <PageShell maxWidth={560}>
        <EmptyState title={t('adminTransactions.unavailable')} />
      </PageShell>
    );

  const status = transactionStatusLabel(x.status);
  const terminal = TERMINAL.has(x.status);
  const cancelPending = x.status === 'CANCELLATION_PENDING';

  return (
    <PageShell maxWidth={1560}>
      <PageHeader
        title={<span dir="ltr">{x.reference}</span>}
        actions={
          !terminal ? (
            <div className="flex flex-wrap gap-2">
              {x.paused ? (
                <ResumeTransactionAction transactionId={x.id} />
              ) : (
                <PauseTransactionAction transactionId={x.id} />
              )}
              <RetryStepAction transactionId={x.id} />
              {cancelPending ? <ResolveCancellationAction transactionId={x.id} /> : null}
              <MarkFailedAction transactionId={x.id} />
            </div>
          ) : null
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <DataSection title={t('adminTransactions.title')}>
            <FieldGrid>
              <Field
                label={t('adminTransactions.col.status')}
                value={<StatusBadge tone={status.tone} label={t(status.key)} />}
              />
              <Field
                label={t('adminTransactions.acceptedAmount')}
                value={formatAed(x.acceptedAmountAed)}
                ltr
              />
              <Field
                label={t('adminTransactions.col.nextActor')}
                value={
                  x.nextActor && t.has(`adminOffers.side.${x.nextActor}`)
                    ? t(`adminOffers.side.${x.nextActor}`)
                    : '—'
                }
              />
              <Field label={t('adminTransactions.route')} value={x.purchaseRoute ?? '—'} />
              <Field label={t('adminTransactions.version')} value={x.version} />
              {x.paused ? (
                <Field label={t('adminTransactions.pauseReason')} value={x.pauseReason ?? '—'} />
              ) : null}
              {x.failureCategory ? (
                <Field label={t('adminTransactions.failureCategory')} value={x.failureCategory} />
              ) : null}
              <Field label={t('adminTransactions.col.activity')} value={formatWhen(x.updatedAt)} />
            </FieldGrid>
          </DataSection>

          <DocumentPanel transactionId={x.id} />
        </div>

        <div className="space-y-6">
          <NotesPanel entityType="transaction" entityId={x.id} />
        </div>
      </div>
    </PageShell>
  );
}
