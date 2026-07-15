import { setRequestLocale, getTranslations } from 'next-intl/server';
import { AlertTriangle } from 'lucide-react';
import { Alert, EmptyState } from '@markaz/ui';
import { getServerApi } from '@/server/api';
import { PageHeader, PageShell } from '@/components/admin/page-header';
import { DataTable, type Column } from '@/components/admin/data-table';
import { StatusBadge } from '@/components/admin/status-badge';
import { FilterTabs, ListPagination } from '@/components/admin/list-controls';
import { SearchBox } from '@/components/admin/search';
import { customerStatusLabel, formatWhen } from '@/components/admin/labels';

const LIMIT = 25;
type Row = Awaited<
  ReturnType<Awaited<ReturnType<typeof getServerApi>>['admin']['customers']['list']>
>[number];

export default async function CustomersPage({
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
  const filter = (
    ['all', 'active', 'restricted', 'onboarding'].includes(sp.filter ?? '') ? sp.filter : 'all'
  ) as 'all' | 'active' | 'restricted' | 'onboarding';
  const query = sp.query?.trim() || undefined;

  let rows: Row[] = [];
  let failed = false;
  try {
    rows = await (
      await getServerApi()
    ).admin.customers.list({ limit: LIMIT, offset, filter, query });
  } catch {
    failed = true;
  }

  const columns: Column<Row>[] = [
    {
      id: 'name',
      header: t('customers.col.name'),
      priority: 'primary',
      cell: (r) => (
        <span className="inline-flex items-center gap-2">
          {r.displayName}
          {r.attention ? (
            <AlertTriangle
              className="h-3.5 w-3.5 text-amber-600"
              aria-label={t('customers.attention')}
            />
          ) : null}
        </span>
      ),
    },
    {
      id: 'email',
      header: t('customers.col.email'),
      priority: 'secondary',
      cell: (r) => <span className="text-muted-foreground">{r.emailMasked}</span>,
    },
    {
      id: 'status',
      header: t('customers.col.status'),
      priority: 'secondary',
      cell: (r) => {
        const s = customerStatusLabel(r.status);
        return <StatusBadge tone={s.tone} label={t(s.key)} />;
      },
    },
    {
      id: 'listings',
      header: t('customers.col.listings'),
      priority: 'low',
      align: 'end',
      cell: (r) => r.listingCount,
    },
    {
      id: 'offers',
      header: t('customers.col.offers'),
      priority: 'low',
      align: 'end',
      cell: (r) => r.activeOfferCount,
    },
    {
      id: 'transactions',
      header: t('customers.col.transactions'),
      priority: 'low',
      align: 'end',
      cell: (r) => r.activeTransactionCount,
    },
    {
      id: 'activity',
      header: t('customers.col.activity'),
      priority: 'low',
      cell: (r) => formatWhen(r.lastActivityAt),
    },
  ];

  return (
    <PageShell maxWidth={1600}>
      <PageHeader title={t('customers.title')} description={t('customers.description')} />
      {failed ? (
        <Alert variant="warning" className="mb-4">
          {t('overview.partialError')}
        </Alert>
      ) : null}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <FilterTabs
          pathname="/customers"
          params={{ query }}
          paramKey="filter"
          active={filter}
          options={(['all', 'active', 'restricted', 'onboarding'] as const).map((v) => ({
            value: v,
            label: t(`customers.filter.${v}`),
          }))}
        />
        <SearchBox placeholder={t('search.placeholder')} />
      </div>
      {rows.length === 0 ? (
        <EmptyState title={t('customers.empty')} />
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(r) => r.id}
            rowHref={(r) => `/customers/${r.id}`}
            caption={t('customers.title')}
          />
          <div className="mt-4">
            <ListPagination
              pathname="/customers"
              params={{ filter, query }}
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
