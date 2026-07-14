import { setRequestLocale, getTranslations } from 'next-intl/server';
import { EmptyState } from '@markaz/ui';
import { getServerApi } from '@/server/api';
import { PageHeader, PageShell } from '@/components/admin/page-header';
import { DataSection, Field, FieldGrid } from '@/components/admin/detail';
import { StatusBadge } from '@/components/admin/status-badge';
import { NotesPanel } from '@/components/admin/notes-panel';
import { CloseOfferAction } from '@/components/admin/entity-actions';
import { offerStatusLabel, formatAed, formatWhen } from '@/components/admin/labels';

const CLOSEABLE = new Set(['OPEN', 'COUNTERED']);

export default async function OfferDetailPage({ params }: { params: Promise<{ locale: string; offerThreadId: string }> }) {
  const { locale, offerThreadId } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('admin');

  let o: Awaited<ReturnType<Awaited<ReturnType<typeof getServerApi>>['admin']['offers']['get']>> | null = null;
  try {
    o = await (await getServerApi()).admin.offers.get({ id: offerThreadId });
  } catch {
    o = null;
  }
  if (!o) return <PageShell maxWidth={560}><EmptyState title={t('adminOffers.unavailable')} /></PageShell>;

  const status = offerStatusLabel(o.status);

  return (
    <PageShell maxWidth={1440}>
      <PageHeader
        title={t('adminOffers.title')}
        actions={CLOSEABLE.has(o.status) ? <CloseOfferAction threadId={o.id} /> : null}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <DataSection title={t('adminOffers.title')}>
            <FieldGrid>
              <Field label={t('adminOffers.col.status')} value={<StatusBadge tone={status.tone} label={t.has(status.key) ? t(status.key) : o.status} />} />
              <Field label={t('adminOffers.col.nextActor')} value={o.nextActor && t.has(`adminOffers.side.${o.nextActor}`) ? t(`adminOffers.side.${o.nextActor}`) : '—'} />
              {o.closedReason ? <Field label={t('adminOffers.closedReason')} value={o.closedReason} /> : null}
            </FieldGrid>
          </DataSection>

          <DataSection title={t('adminOffers.proposals')}>
            <p className="mb-3 text-xs text-muted-foreground">{t('adminOffers.proposalsHint')}</p>
            <ol className="space-y-2">
              {o.proposals.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
                  <span className="font-medium">{t.has(`adminOffers.side.${p.side}`) ? t(`adminOffers.side.${p.side}`) : p.side}</span>
                  <span dir="ltr" className="font-mono">{formatAed(p.amountAed)}</span>
                  <StatusBadge tone="neutral" label={t.has(`adminOffers.proposalStatus.${p.status}`) ? t(`adminOffers.proposalStatus.${p.status}`) : p.status} />
                  <span className="text-muted-foreground">{formatWhen(p.createdAt)}</span>
                </li>
              ))}
            </ol>
          </DataSection>
        </div>

        <div className="space-y-6">
          <NotesPanel entityType="offer_thread" entityId={o.id} />
        </div>
      </div>
    </PageShell>
  );
}
