import { setRequestLocale, getTranslations } from 'next-intl/server';
import { PauseCircle } from 'lucide-react';
import { Alert, EmptyState } from '@markaz/ui';
import { getServerApi } from '@/server/api';
import { PageHeader, PageShell } from '@/components/admin/page-header';
import { DataTable, type Column } from '@/components/admin/data-table';
import { StatusBadge } from '@/components/admin/status-badge';
import { ListPagination } from '@/components/admin/list-controls';
import { SearchBox } from '@/components/admin/search';
import { transactionStatusLabel, formatAed, formatWhen } from '@/components/admin/labels';

const LIMIT = 25;
type Row = Awaited<
  ReturnType<Awaited<ReturnType<typeof getServerApi>>['admin']['transactions']['list']>
>[number];

export default async function TransactionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations('admin');

  const offset = Math.max(0, Number(sp.offset ?? 0) || 0);
  const status = sp.status || undefined;
  const query = sp.query?.trim() || undefined;

  let rows: Row[] = [];
  let failed = false;
  try {
    rows = await (
      await getServerApi()
    ).admin.transactions.list({ limit: LIMIT, offset, status, query });
  } catch {
    failed = true;
  }

  const columns: Column<Row>[] = [
    {
      id: 'reference',
      header: t('adminTransactions.col.reference'),
      priority: 'primary',
      cell: (r) => (
        <span className="inline-flex items-center gap-2">
          <span dir="ltr" className="font-mono text-xs">
            {r.reference}
          </span>
          {r.paused ? (
            <PauseCircle
              className="h-3.5 w-3.5 text-slate-500"
              aria-label={t('adminTransactions.paused')}
            />
          ) : null}
        </span>
      ),
    },
    {
      id: 'status',
      header: t('adminTransactions.col.status'),
      priority: 'secondary',
      cell: (r) => {
        const s = transactionStatusLabel(r.status);
        return <StatusBadge tone={s.tone} label={t(s.key)} />;
      },
    },
    {
      id: 'amount',
      header: t('adminTransactions.col.amount'),
      priority: 'secondary',
      align: 'end',
      cell: (r) => (
        <span dir="ltr" className="font-mono">
          {formatAed(r.acceptedAmountAed)}
        </span>
      ),
    },
    {
      id: 'nextActor',
      header: t('adminTransactions.col.nextActor'),
      priority: 'low',
      cell: (r) =>
        r.nextActor && t.has(`adminOffers.side.${r.nextActor}`)
          ? t(`adminOffers.side.${r.nextActor}`)
          : '—',
    },
    {
      id: 'activity',
      header: t('adminTransactions.col.activity'),
      priority: 'low',
      cell: (r) => formatWhen(r.updatedAt),
    },
  ];

  return (
    <PageShell maxWidth={1600}>
      <PageHeader
        title={t('adminTransactions.title')}
        description={t('adminTransactions.description')}
      />
      {failed ? (
        <Alert variant="warning" className="mb-4">
          {t('overview.partialError')}
        </Alert>
      ) : null}
      <div className="mb-4 flex justify-end">
        <SearchBox placeholder={t('adminTransactions.searchPlaceholder')} />
      </div>
      {rows.length === 0 ? (
        <EmptyState title={t('adminTransactions.empty')} />
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(r) => r.id}
            rowHref={(r) => `/transactions/${r.id}`}
            caption={t('adminTransactions.title')}
          />
          <div className="mt-4">
            <ListPagination
              pathname="/transactions"
              params={{ status, query }}
              offset={offset}
              limit={LIMIT}
              count={rows.length}
              labels={{
                prev: t('prev'),
                next: t('next'),
                range: t('paginationRange', { from: offset + 1, to: offset + rows.length }),
              }}
            />
          </div>
        </>
      )}
    </PageShell>
  );
}
