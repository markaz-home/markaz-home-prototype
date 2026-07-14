import { setRequestLocale, getTranslations } from 'next-intl/server';
import {
  Users,
  Ban,
  Building2,
  PauseCircle,
  CheckCircle2,
  Tag,
  Receipt,
  XCircle,
  FileCheck2,
  AlertTriangle,
} from 'lucide-react';
import { Alert, Card, CardContent, CardHeader, CardTitle } from '@markaz/ui';
import { Link } from '@/i18n/navigation';
import { getServerApi } from '@/server/api';
import { PageHeader, PageShell } from '@/components/admin/page-header';
import { QueueLive } from '@/components/admin/queue-live';

type Metrics = Awaited<
  ReturnType<Awaited<ReturnType<typeof getServerApi>>['admin']['overview']['metrics']>
>;

export default async function OverviewPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('admin');

  let m: Metrics | null = null;
  let failed = false;
  try {
    m = await (await getServerApi()).admin.overview.metrics();
  } catch {
    failed = true;
  }

  const cards: { icon: typeof Users; key: keyof Metrics; href: string }[] = [
    { icon: Users, key: 'activeCustomers', href: '/customers?filter=active' },
    { icon: Ban, key: 'restrictedCustomers', href: '/customers?filter=restricted' },
    { icon: Building2, key: 'liveListings', href: '/listings?state=LIVE' },
    { icon: PauseCircle, key: 'pausedListings', href: '/listings?state=PAUSED' },
    { icon: CheckCircle2, key: 'soldListings', href: '/listings?state=SOLD_DEMO' },
    { icon: Tag, key: 'activeThreads', href: '/offers' },
    { icon: CheckCircle2, key: 'acceptedOffers', href: '/offers?status=ACCEPTED' },
    { icon: Receipt, key: 'activeTransactions', href: '/transactions' },
    { icon: XCircle, key: 'failedTransactions', href: '/transactions?status=FAILED' },
    {
      icon: CheckCircle2,
      key: 'completedTransactions',
      href: '/transactions?status=COMPLETED_DEMO',
    },
    { icon: FileCheck2, key: 'publicationPending', href: '/publication?filter=pending' },
    { icon: AlertTriangle, key: 'publicationFailed', href: '/publication?filter=returned' },
  ];

  const queues = [
    { key: 'publication', value: m?.publicationPending, href: '/publication?filter=pending' },
    { key: 'transactions', value: m?.failedTransactions, href: '/transactions?status=FAILED' },
    { key: 'verifications', value: undefined, href: '/verifications' },
    { key: 'pausedListings', value: m?.pausedListings, href: '/listings?state=PAUSED' },
  ] as const;
  const attention = queues.filter((q) => (q.value ?? 0) > 0);

  return (
    <PageShell maxWidth={1600}>
      <PageHeader title={t('overview.title')} description={t('overview.description')} />
      {failed ? (
        <Alert variant="warning" className="mb-6">
          {t('overview.partialError')}
        </Alert>
      ) : null}

      <section aria-label={t('overview.queue.title')} className="mb-8">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-muted-foreground text-sm font-semibold uppercase tracking-wide">
            {t('overview.queue.title')}
          </h2>
          {/* Live: refetches these queues when a publication/transaction changes. */}
          <QueueLive />
        </div>
        {attention.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {attention.map((q) => (
              <Link
                key={q.key}
                href={q.href}
                className="rounded-lg border bg-amber-50 p-4 transition-colors hover:bg-amber-100"
              >
                <p className="text-2xl font-semibold tabular-nums text-amber-900">{q.value}</p>
                <p className="text-sm text-amber-900">{t(`overview.queue.${q.key}`)}</p>
              </Link>
            ))}
          </div>
        ) : (
          <p className="bg-muted/40 text-muted-foreground rounded-lg border p-4 text-sm">
            {t('overview.queue.empty')}
          </p>
        )}
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {cards.map(({ icon: Icon, key, href }) => (
          <Link key={key} href={href}>
            <Card className="hover:bg-muted/40 h-full transition-colors">
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-muted-foreground text-sm font-medium">
                  {t(`overview.metric.${key}`)}
                </CardTitle>
                <Icon className="text-muted-foreground h-4 w-4" aria-hidden />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold tabular-nums">{m ? m[key] : '—'}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </PageShell>
  );
}
