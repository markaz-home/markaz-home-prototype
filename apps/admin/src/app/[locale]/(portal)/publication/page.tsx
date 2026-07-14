import { setRequestLocale, getTranslations } from 'next-intl/server';
import { Alert, EmptyState } from '@markaz/ui';
import { getServerApi } from '@/server/api';
import { PageHeader, PageShell } from '@/components/admin/page-header';
import { DataTable, type Column } from '@/components/admin/data-table';
import { StatusBadge } from '@/components/admin/status-badge';
import { FilterTabs, ListPagination } from '@/components/admin/list-controls';
import { publicationStatusLabel, formatWhen } from '@/components/admin/labels';

const LIMIT = 25;
type Row = Awaited<
  ReturnType<Awaited<ReturnType<typeof getServerApi>>['admin']['publication']['queue']>
>[number];

export default async function PublicationPage({
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
    ['pending', 'returned', 'all'].includes(sp.filter ?? '') ? sp.filter : 'pending'
  ) as 'pending' | 'returned' | 'all';

  let rows: Row[] = [];
  let failed = false;
  try {
    rows = await (await getServerApi()).admin.publication.queue({ limit: LIMIT, offset, filter });
  } catch {
    failed = true;
  }

  const columns: Column<Row>[] = [
    {
      id: 'title',
      header: t('publication.col.title'),
      priority: 'primary',
      cell: (r) => r.title ?? '—',
    },
    {
      id: 'reference',
      header: t('publication.col.reference'),
      priority: 'secondary',
      cell: (r) => (
        <span dir="ltr" className="font-mono text-xs">
          {r.publicId ?? '—'}
        </span>
      ),
    },
    {
      id: 'status',
      header: t('publication.col.status'),
      priority: 'secondary',
      cell: (r) => {
        const s = publicationStatusLabel(r.status);
        return <StatusBadge tone={s.tone} label={t(s.key)} />;
      },
    },
    {
      id: 'submitted',
      header: t('publication.col.submitted'),
      priority: 'low',
      cell: (r) => formatWhen(r.submittedAt),
    },
  ];

  return (
    <PageShell maxWidth={1600}>
      <PageHeader title={t('publication.title')} description={t('publication.description')} />
      {failed ? (
        <Alert variant="warning" className="mb-4">
          {t('overview.partialError')}
        </Alert>
      ) : null}
      <div className="mb-4">
        <FilterTabs
          pathname="/publication"
          params={{}}
          paramKey="filter"
          active={filter}
          options={(['pending', 'returned', 'all'] as const).map((v) => ({
            value: v,
            label: t(`publication.filter.${v}`),
          }))}
        />
      </div>
      {rows.length === 0 ? (
        <EmptyState title={t('publication.empty')} />
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(r) => r.id}
            rowHref={(r) => `/publication/${r.id}`}
            caption={t('publication.title')}
          />
          <div className="mt-4">
            <ListPagination
              pathname="/publication"
              params={{ filter }}
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
