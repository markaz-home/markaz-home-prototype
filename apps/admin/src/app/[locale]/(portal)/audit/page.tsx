import { setRequestLocale, getTranslations } from 'next-intl/server';
import { Alert, EmptyState } from '@markaz/ui';
import { getServerApi } from '@/server/api';
import { PageHeader, PageShell } from '@/components/admin/page-header';
import { DataTable, type Column } from '@/components/admin/data-table';
import { StatusBadge } from '@/components/admin/status-badge';
import { ListPagination } from '@/components/admin/list-controls';
import { actorTypeTone, formatWhen } from '@/components/admin/labels';

const LIMIT = 25;
type Row = Awaited<ReturnType<Awaited<ReturnType<typeof getServerApi>>['admin']['audit']['list']>>[number];

export default async function AuditPage({
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
  const action = sp.action?.trim() || undefined;
  const entityType = sp.entityType?.trim() || undefined;

  let rows: Row[] = [];
  let failed = false;
  try {
    rows = await (await getServerApi()).admin.audit.list({ limit: LIMIT, offset, action, entityType });
  } catch {
    failed = true;
  }

  const columns: Column<Row>[] = [
    { id: 'time', header: t('audit.col.time'), priority: 'primary', cell: (r) => <span dir="ltr" className="font-mono text-xs">{formatWhen(r.createdAt)}</span> },
    { id: 'actor', header: t('audit.col.actor'), priority: 'secondary', cell: (r) => <StatusBadge tone={actorTypeTone(r.actorType)} label={t(`audit.actor.${r.actorType}`)} /> },
    { id: 'action', header: t('audit.col.action'), priority: 'secondary', cell: (r) => <span className="font-mono text-xs">{r.action}</span> },
    { id: 'entity', header: t('audit.col.entity'), priority: 'low', cell: (r) => r.entityType },
    { id: 'result', header: t('audit.col.result'), priority: 'low', cell: (r) => (r.metadata as { result?: string })?.result ?? '—' },
  ];

  return (
    <PageShell maxWidth={1600}>
      <PageHeader title={t('audit.title')} description={t('audit.description')} />
      {failed ? <Alert variant="warning" className="mb-4">{t('overview.partialError')}</Alert> : null}
      {rows.length === 0 ? (
        <EmptyState title={t('audit.empty')} />
      ) : (
        <>
          <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} rowHref={(r) => `/audit/${r.id}`} caption={t('audit.title')} />
          <div className="mt-4">
            <ListPagination
              pathname="/audit"
              params={{ action, entityType }}
              offset={offset}
              limit={LIMIT}
              count={rows.length}
              labels={{ prev: t('prev'), next: t('next'), range: t('paginationRange', { from: offset + 1, to: offset + rows.length }) }}
            />
          </div>
        </>
      )}
    </PageShell>
  );
}
