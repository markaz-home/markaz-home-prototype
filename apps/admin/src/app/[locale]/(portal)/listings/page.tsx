import { setRequestLocale, getTranslations } from 'next-intl/server';
import { Alert, EmptyState } from '@markaz/ui';
import { getServerApi } from '@/server/api';
import { PageHeader, PageShell } from '@/components/admin/page-header';
import { DataTable, type Column } from '@/components/admin/data-table';
import { StatusBadge } from '@/components/admin/status-badge';
import { ListPagination } from '@/components/admin/list-controls';
import { SearchBox } from '@/components/admin/search';
import { listingStateLabel, formatWhen } from '@/components/admin/labels';

const LIMIT = 25;
type Row = Awaited<
  ReturnType<Awaited<ReturnType<typeof getServerApi>>['admin']['listings']['list']>
>[number];

export default async function ListingsPage({
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
  const state = sp.state || undefined;
  const query = sp.query?.trim() || undefined;

  let rows: Row[] = [];
  let failed = false;
  try {
    rows = await (await getServerApi()).admin.listings.list({ limit: LIMIT, offset, state, query });
  } catch {
    failed = true;
  }

  const columns: Column<Row>[] = [
    { id: 'title', header: t('listings.col.title'), priority: 'primary', cell: (r) => r.title },
    {
      id: 'reference',
      header: t('listings.col.reference'),
      priority: 'secondary',
      cell: (r) => (
        <span dir="ltr" className="font-mono text-xs">
          {r.publicId ?? '—'}
        </span>
      ),
    },
    {
      id: 'state',
      header: t('listings.col.state'),
      priority: 'secondary',
      cell: (r) => {
        const s = listingStateLabel(r.state);
        return <StatusBadge tone={s.tone} label={t(s.key)} />;
      },
    },
    {
      id: 'location',
      header: t('listings.col.location'),
      priority: 'low',
      cell: (r) => [r.community, r.emirate].filter(Boolean).join(', ') || '—',
    },
    {
      id: 'activity',
      header: t('listings.col.activity'),
      priority: 'low',
      cell: (r) => formatWhen(r.updatedAt),
    },
  ];

  return (
    <PageShell maxWidth={1600}>
      <PageHeader title={t('listings.title')} description={t('listings.description')} />
      {failed ? (
        <Alert variant="warning" className="mb-4">
          {t('overview.partialError')}
        </Alert>
      ) : null}
      <div className="mb-4 flex justify-end">
        <SearchBox placeholder={t('listings.searchPlaceholder')} />
      </div>
      {rows.length === 0 ? (
        <EmptyState title={t('listings.empty')} />
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(r) => r.id}
            rowHref={(r) => `/listings/${r.id}`}
            caption={t('listings.title')}
          />
          <div className="mt-4">
            <ListPagination
              pathname="/listings"
              params={{ state, query }}
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
