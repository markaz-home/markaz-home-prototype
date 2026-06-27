import { setRequestLocale, getTranslations } from 'next-intl/server';
import { Building2, FileSearch, Tag, Receipt, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Alert, Card, CardContent, CardHeader, CardTitle } from '@markaz/ui';
import { getServerApi } from '@/server/api';

export default async function OverviewPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('admin');

  let metrics: Awaited<ReturnType<Awaited<ReturnType<typeof getServerApi>>['adminOverview']['metrics']>> | null =
    null;
  let failed = false;
  try {
    const api = await getServerApi();
    metrics = await api.adminOverview.metrics();
  } catch {
    failed = true;
  }

  const cards = [
    { icon: Building2, label: t('metricActiveListings'), value: metrics?.activeListings },
    { icon: FileSearch, label: t('metricListingsAwaitingReview'), value: metrics?.listingsAwaitingReview },
    { icon: Tag, label: t('metricPendingOffers'), value: metrics?.pendingOffers },
    { icon: Receipt, label: t('metricActiveTransactions'), value: metrics?.activeTransactions },
    { icon: AlertTriangle, label: t('metricFlaggedTransactions'), value: metrics?.flaggedTransactions },
    { icon: CheckCircle2, label: t('metricCompletedDemoTransactions'), value: metrics?.completedDemoTransactions },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t('overviewTitle')}</h1>
      {failed ? <Alert variant="warning">{t('metricsPartialError')}</Alert> : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(({ icon: Icon, label, value }) => (
          <Card key={label}>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold tabular-nums">{value ?? '—'}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
