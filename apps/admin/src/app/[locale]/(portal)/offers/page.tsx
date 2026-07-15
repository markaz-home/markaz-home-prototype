import { setRequestLocale, getTranslations } from 'next-intl/server';
import { Alert, EmptyState } from '@markaz/ui';
import { getServerApi } from '@/server/api';
import { PageHeader, PageShell } from '@/components/admin/page-header';
import { DataTable, type Column } from '@/components/admin/data-table';
import { StatusBadge } from '@/components/admin/status-badge';
import { ListPagination } from '@/components/admin/list-controls';
import { offerStatusLabel, formatWhen } from '@/components/admin/labels';

const LIMIT = 25;
type Row = Awaited<
  ReturnType<Awaited<ReturnType<typeof getServerApi>>['admin']['offers']['list']>
>[number];

export default async function OffersPage({
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

  let rows: Row[] = [];
  let failed = false;
  try {
    rows = await (await getServerApi()).admin.offers.list({ limit: LIMIT, offset, status });
  } catch {
    failed = true;
  }

  const columns: Column<Row>[] = [
    {
      id: 'reference',
      header: t('adminOffers.col.reference'),
      priority: 'primary',
      cell: (r) => (
        <span dir="ltr" className="font-mono text-xs">
          #{r.buyerSeq}
        </span>
      ),
    },
    {
      id: 'status',
      header: t('adminOffers.col.status'),
      priority: 'secondary',
      cell: (r) => {
        const s = offerStatusLabel(r.status);
        return <StatusBadge tone={s.tone} label={t.has(s.key) ? t(s.key) : r.status} />;
      },
    },
    {
      id: 'nextActor',
      header: t('adminOffers.col.nextActor'),
      priority: 'low',
      cell: (r) =>
        r.nextActor && t.has(`adminOffers.side.${r.nextActor}`)
          ? t(`adminOffers.side.${r.nextActor}`)
          : '—',
    },
    {
      id: 'activity',
      header: t('adminOffers.col.activity'),
      priority: 'low',
      cell: (r) => formatWhen(r.lastActivityAt),
    },
  ];

  return (
    <PageShell maxWidth={1600}>
      <PageHeader title={t('adminOffers.title')} description={t('adminOffers.description')} />
      {failed ? (
        <Alert variant="warning" className="mb-4">
          {t('overview.partialError')}
        </Alert>
      ) : null}
      {rows.length === 0 ? (
        <EmptyState title={t('adminOffers.empty')} />
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(r) => r.id}
            rowHref={(r) => `/offers/${r.id}`}
            caption={t('adminOffers.title')}
          />
          <div className="mt-4">
            <ListPagination
              pathname="/offers"
              params={{ status }}
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
