import { setRequestLocale, getTranslations } from 'next-intl/server';
import { EmptyState } from '@markaz/ui';
import { getServerApi } from '@/server/api';
import { PageHeader, PageShell } from '@/components/admin/page-header';
import { DataSection, Field, FieldGrid } from '@/components/admin/detail';
import { StatusBadge } from '@/components/admin/status-badge';
import { NotesPanel } from '@/components/admin/notes-panel';
import { RestrictCustomerAction, RestoreCustomerAction } from '@/components/admin/entity-actions';
import { customerStatusLabel, formatWhen } from '@/components/admin/labels';

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ locale: string; customerId: string }>;
}) {
  const { locale, customerId } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('admin');

  let c: Awaited<
    ReturnType<Awaited<ReturnType<typeof getServerApi>>['admin']['customers']['get']>
  > | null = null;
  try {
    c = await (await getServerApi()).admin.customers.get({ id: customerId });
  } catch {
    c = null;
  }
  if (!c)
    return (
      <PageShell maxWidth={560}>
        <EmptyState title={t('customers.unavailable')} />
      </PageShell>
    );

  const status = customerStatusLabel(c.status);

  return (
    <PageShell maxWidth={1440}>
      <PageHeader
        title={c.displayName}
        description={c.emailMasked}
        actions={
          c.status === 'ACTIONS_RESTRICTED' ? (
            <RestoreCustomerAction customerId={c.id} />
          ) : (
            <RestrictCustomerAction customerId={c.id} />
          )
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <DataSection title={t('customers.title')}>
            <FieldGrid>
              <Field
                label={t('customers.col.status')}
                value={<StatusBadge tone={status.tone} label={t(status.key)} />}
              />
              <Field label={t('customers.identity')} value={c.identityStatus} />
              <Field
                label={t('customers.onboarded')}
                value={c.onboarded ? t('yes') : t('customers.notOnboarded')}
              />
              <Field label={t('customers.col.listings')} value={c.listingCount} />
              <Field label={t('customers.col.offers')} value={c.activeOfferCount} />
              <Field label={t('customers.col.transactions')} value={c.activeTransactionCount} />
              <Field label={t('customers.joined')} value={formatWhen(c.createdAt)} />
              <Field label={t('customers.col.activity')} value={formatWhen(c.lastActivityAt)} />
            </FieldGrid>
          </DataSection>

          {c.status === 'ACTIONS_RESTRICTED' ? (
            <DataSection title={t('customers.status.restricted')} visibility="private">
              <FieldGrid>
                <Field
                  label={t('customers.restrictionReason')}
                  value={
                    c.restrictionReason ? t(`customer.restrict.reason.${c.restrictionReason}`) : '—'
                  }
                />
                <Field label={t('customers.restrictedSince')} value={formatWhen(c.restrictedAt)} />
              </FieldGrid>
            </DataSection>
          ) : null}
        </div>

        <div className="space-y-6">
          <NotesPanel entityType="customer" entityId={c.id} />
        </div>
      </div>
    </PageShell>
  );
}
