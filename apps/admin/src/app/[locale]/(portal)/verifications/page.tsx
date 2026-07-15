import { setRequestLocale, getTranslations } from 'next-intl/server';
import { Alert, EmptyState } from '@markaz/ui';
import { getServerApi } from '@/server/api';
import { PageHeader, PageShell } from '@/components/admin/page-header';
import { DataTable, type Column } from '@/components/admin/data-table';
import { StatusBadge } from '@/components/admin/status-badge';
import { ListPagination } from '@/components/admin/list-controls';
import { verificationStatusLabel, formatWhen } from '@/components/admin/labels';

const LIMIT = 25;
type Row = Awaited<
  ReturnType<Awaited<ReturnType<typeof getServerApi>>['admin']['verifications']['list']>
>[number];

export default async function VerificationsPage({
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

  let rows: Row[] = [];
  let failed = false;
  try {
    rows = await (await getServerApi()).admin.verifications.list({ limit: LIMIT, offset });
  } catch {
    failed = true;
  }

  const columns: Column<Row>[] = [
    {
      id: 'kind',
      header: t('verifications.col.kind'),
      priority: 'primary',
      cell: (r) =>
        t.has(`verifications.kind.${r.kind}`) ? t(`verifications.kind.${r.kind}`) : r.kind,
    },
    {
      id: 'status',
      header: t('verifications.col.status'),
      priority: 'secondary',
      cell: (r) => {
        const s = verificationStatusLabel(r.status);
        return (
          <span className="inline-flex items-center gap-2">
            <StatusBadge tone={s.tone} label={t.has(s.key) ? t(s.key) : r.status} />
            {r.superseded ? (
              <span className="text-muted-foreground text-xs">{t('verifications.superseded')}</span>
            ) : null}
          </span>
        );
      },
    },
    {
      id: 'created',
      header: t('verifications.col.created'),
      priority: 'low',
      cell: (r) => formatWhen(r.createdAt),
    },
  ];

  return (
    <PageShell maxWidth={1600}>
      <PageHeader title={t('verifications.title')} description={t('verifications.description')} />
      {failed ? (
        <Alert variant="warning" className="mb-4">
          {t('overview.partialError')}
        </Alert>
      ) : null}
      {rows.length === 0 ? (
        <EmptyState title={t('verifications.empty')} />
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(r) => r.id}
            rowHref={(r) => `/verifications/${r.id}`}
            caption={t('verifications.title')}
          />
          <div className="mt-4">
            <ListPagination
              pathname="/verifications"
              params={{}}
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
