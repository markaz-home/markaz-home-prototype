import { setRequestLocale, getTranslations } from 'next-intl/server';
import { Badge, EmptyState } from '@markaz/ui';
import { getServerApi } from '@/server/api';
import { PageHeader, PageShell } from '@/components/admin/page-header';
import { DataSection, Field, FieldGrid } from '@/components/admin/detail';
import { StatusBadge } from '@/components/admin/status-badge';
import { NotesPanel } from '@/components/admin/notes-panel';
import { RetryVerificationAction } from '@/components/admin/entity-actions';
import { verificationStatusLabel, formatWhen } from '@/components/admin/labels';

export default async function VerificationDetailPage({
  params,
}: {
  params: Promise<{ locale: string; verificationId: string }>;
}) {
  const { locale, verificationId } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('admin');

  let v: Awaited<
    ReturnType<Awaited<ReturnType<typeof getServerApi>>['admin']['verifications']['get']>
  > | null = null;
  try {
    v = await (await getServerApi()).admin.verifications.get({ id: verificationId });
  } catch {
    v = null;
  }
  if (!v)
    return (
      <PageShell maxWidth={560}>
        <EmptyState title={t('verifications.unavailable')} />
      </PageShell>
    );

  const status = verificationStatusLabel(v.status);
  const canRetry = v.status === 'FAILED_DEMO' && !v.superseded;

  return (
    <PageShell maxWidth={1480}>
      <PageHeader
        title={t.has(`verifications.kind.${v.kind}`) ? t(`verifications.kind.${v.kind}`) : v.kind}
        actions={canRetry ? <RetryVerificationAction verificationId={v.id} /> : null}
        breadcrumb={<Badge variant="warning">{t('simulated')}</Badge>}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <DataSection title={t('verifications.title')}>
            <FieldGrid>
              <Field
                label={t('verifications.col.status')}
                value={
                  <StatusBadge
                    tone={status.tone}
                    label={t.has(status.key) ? t(status.key) : v.status}
                  />
                }
              />
              <Field label={t('verifications.col.created')} value={formatWhen(v.createdAt)} />
              {v.superseded ? (
                <Field
                  label={t('verifications.col.status')}
                  value={t('verifications.superseded')}
                />
              ) : null}
              {v.failureReason ? (
                <Field label={t('verifications.failureReason')} value={v.failureReason} />
              ) : null}
            </FieldGrid>
          </DataSection>
        </div>
        <div className="space-y-6">
          {v.listingId ? <NotesPanel entityType="listing" entityId={v.listingId} /> : null}
        </div>
      </div>
    </PageShell>
  );
}
