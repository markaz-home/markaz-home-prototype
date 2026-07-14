import { setRequestLocale, getTranslations } from 'next-intl/server';
import { EmptyState } from '@markaz/ui';
import { getServerApi } from '@/server/api';
import { PageHeader, PageShell } from '@/components/admin/page-header';
import { DataSection, Field, FieldGrid } from '@/components/admin/detail';
import { StatusBadge } from '@/components/admin/status-badge';
import { actorTypeTone, formatWhen } from '@/components/admin/labels';

export default async function AuditDetailPage({ params }: { params: Promise<{ locale: string; auditEventId: string }> }) {
  const { locale, auditEventId } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('admin');

  let e: Awaited<ReturnType<Awaited<ReturnType<typeof getServerApi>>['admin']['audit']['get']>> | null = null;
  try {
    e = await (await getServerApi()).admin.audit.get({ id: auditEventId });
  } catch {
    e = null;
  }
  if (!e) return <PageShell maxWidth={560}><EmptyState title={t('audit.unavailable')} /></PageShell>;

  const meta = Object.entries(e.metadata as Record<string, unknown>);

  return (
    <PageShell maxWidth={1440}>
      <PageHeader title={<span className="font-mono">{e.action}</span>} />
      <DataSection title={t('audit.title')}>
        <FieldGrid>
          <Field label={t('audit.col.actor')} value={<StatusBadge tone={actorTypeTone(e.actorType)} label={t(`audit.actor.${e.actorType}`)} />} />
          <Field label={t('audit.col.time')} value={<span dir="ltr" className="font-mono">{formatWhen(e.createdAt)}</span>} />
          <Field label={t('audit.col.entity')} value={e.entityType} />
        </FieldGrid>
      </DataSection>
      {meta.length > 0 ? (
        <div className="mt-6">
          <DataSection title={t('audit.metadata')}>
            <dl className="space-y-1 text-sm">
              {meta.map(([k, v]) => (
                <div key={k} className="flex gap-2">
                  <dt className="font-medium text-muted-foreground">{k}:</dt>
                  <dd className="font-mono">{String(v)}</dd>
                </div>
              ))}
            </dl>
          </DataSection>
        </div>
      ) : null}
    </PageShell>
  );
}
