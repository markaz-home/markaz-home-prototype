import { setRequestLocale, getTranslations } from 'next-intl/server';
import { CheckCircle2, XCircle } from 'lucide-react';
import { EmptyState } from '@markaz/ui';
import { getServerApi } from '@/server/api';
import { PageHeader, PageShell } from '@/components/admin/page-header';
import { DataSection, Field, FieldGrid } from '@/components/admin/detail';
import { StatusBadge } from '@/components/admin/status-badge';
import { NotesPanel } from '@/components/admin/notes-panel';
import {
  ApprovePublicationAction,
  ReturnPublicationAction,
} from '@/components/admin/entity-actions';
import { publicationStatusLabel, formatAed, formatWhen } from '@/components/admin/labels';

export default async function PublicationDetailPage({
  params,
}: {
  params: Promise<{ locale: string; publicationRequestId: string }>;
}) {
  const { locale, publicationRequestId } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('admin');

  let r: Awaited<
    ReturnType<Awaited<ReturnType<typeof getServerApi>>['admin']['publication']['get']>
  > | null = null;
  try {
    r = await (await getServerApi()).admin.publication.get({ id: publicationRequestId });
  } catch {
    r = null;
  }
  if (!r)
    return (
      <PageShell maxWidth={560}>
        <EmptyState title={t('publication.unavailable')} />
      </PageShell>
    );

  const status = publicationStatusLabel(r.status);
  const isPending = r.status === 'PENDING';

  const checks = [
    { key: 'readyToPublish', pass: r.checklist.readyToPublish },
    { key: 'hasProperty', pass: r.checklist.hasProperty },
  ];

  return (
    <PageShell maxWidth={1480}>
      <PageHeader
        title={r.listing?.title ?? t('publication.title')}
        description={r.listing?.publicId ?? undefined}
        actions={
          isPending ? (
            <div className="flex gap-2">
              <ApprovePublicationAction requestId={r.id} />
              <ReturnPublicationAction requestId={r.id} />
            </div>
          ) : null
        }
      />
      {!isPending ? (
        <div className="mb-4">
          <StatusBadge tone={status.tone} label={t('publication.conflict')} />
        </div>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <DataSection title={t('publication.title')}>
            <FieldGrid>
              <Field
                label={t('publication.col.status')}
                value={<StatusBadge tone={status.tone} label={t(status.key)} />}
              />
              <Field label={t('publication.col.submitted')} value={formatWhen(r.submittedAt)} />
              {r.listing ? (
                <Field
                  label={t('listing.askingPrice')}
                  value={formatAed(r.listing.askingPriceAed)}
                  ltr
                />
              ) : null}
            </FieldGrid>
          </DataSection>

          <DataSection title={t('publication.checklist.title')}>
            <ul className="space-y-2">
              {checks.map((c) => (
                <li key={c.key} className="flex items-center justify-between gap-2 text-sm">
                  <span>{t(`publication.checklist.${c.key}`)}</span>
                  {c.pass ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700">
                      <CheckCircle2 className="h-4 w-4" aria-hidden />
                      {t('publication.checklist.pass')}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-red-700">
                      <XCircle className="h-4 w-4" aria-hidden />
                      {t('publication.checklist.fail')}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </DataSection>
        </div>

        <div className="space-y-6">
          <NotesPanel entityType="listing" entityId={r.listingId} />
        </div>
      </div>
    </PageShell>
  );
}
