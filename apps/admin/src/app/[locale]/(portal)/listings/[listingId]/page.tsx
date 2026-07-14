import { setRequestLocale, getTranslations } from 'next-intl/server';
import { EmptyState } from '@markaz/ui';
import { getServerApi } from '@/server/api';
import { PageHeader, PageShell } from '@/components/admin/page-header';
import { DataSection, Field, FieldGrid } from '@/components/admin/detail';
import { StatusBadge } from '@/components/admin/status-badge';
import { NotesPanel } from '@/components/admin/notes-panel';
import { PauseListingAction, ResumeListingAction } from '@/components/admin/entity-actions';
import {
  listingStateLabel,
  publicationStatusLabel,
  formatAed,
  formatWhen,
} from '@/components/admin/labels';

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ locale: string; listingId: string }>;
}) {
  const { locale, listingId } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('admin');

  let l: Awaited<
    ReturnType<Awaited<ReturnType<typeof getServerApi>>['admin']['listings']['get']>
  > | null = null;
  try {
    l = await (await getServerApi()).admin.listings.get({ id: listingId });
  } catch {
    l = null;
  }
  if (!l)
    return (
      <PageShell maxWidth={560}>
        <EmptyState title={t('listings.unavailable')} />
      </PageShell>
    );

  const state = listingStateLabel(l.state);
  const canPause = l.state === 'LIVE';
  const canResume = l.state === 'PAUSED';

  return (
    <PageShell maxWidth={1520}>
      <PageHeader
        title={l.title}
        description={l.publicId ?? undefined}
        actions={
          <div className="flex gap-2">
            {canPause ? <PauseListingAction listingId={l.id} /> : null}
            {canResume ? <ResumeListingAction listingId={l.id} /> : null}
          </div>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <DataSection title={t('listings.title')}>
            <FieldGrid>
              <Field
                label={t('listings.col.state')}
                value={<StatusBadge tone={state.tone} label={t(state.key)} />}
              />
              <Field label={t('listing.askingPrice')} value={formatAed(l.askingPriceAed)} ltr />
              {l.pausedAt ? (
                <Field label={t('listing.pausedSince')} value={formatWhen(l.pausedAt)} />
              ) : null}
              {l.publication ? (
                <Field
                  label={t('listing.publication')}
                  value={
                    <StatusBadge
                      {...(() => {
                        const p = publicationStatusLabel(l.publication.status);
                        return { tone: p.tone, label: t(p.key) };
                      })()}
                    />
                  }
                />
              ) : null}
            </FieldGrid>
          </DataSection>

          {l.public ? (
            <DataSection title={t('listing.publicSection')} visibility="public">
              <FieldGrid>
                <Field label={t('listing.field.propertyType')} value={l.public.propertyType} />
                <Field label={t('listing.field.community')} value={l.public.community} />
                <Field label={t('listing.field.emirate')} value={l.public.emirate} />
                <Field
                  label={t('listing.field.buildingOrProject')}
                  value={l.public.buildingOrProject}
                />
                <Field label={t('listing.field.bedrooms')} value={l.public.bedrooms} />
                <Field label={t('listing.field.bathrooms')} value={l.public.bathrooms} />
              </FieldGrid>
            </DataSection>
          ) : null}

          {l.private ? (
            <DataSection title={t('listing.privateSection')} visibility="private">
              <FieldGrid>
                <Field label={t('listing.field.unitIdentifier')} value={l.private.unitIdentifier} />
                <Field
                  label={t('listing.field.occupancyStatus')}
                  value={l.private.occupancyStatus}
                />
              </FieldGrid>
            </DataSection>
          ) : null}
        </div>

        <div className="space-y-6">
          <NotesPanel entityType="listing" entityId={l.id} />
        </div>
      </div>
    </PageShell>
  );
}
