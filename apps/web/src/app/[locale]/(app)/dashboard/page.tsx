import { setRequestLocale, getTranslations } from 'next-intl/server';
import { ArrowRight, Bookmark, Building2, FileText, Inbox, Receipt, Bell } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@markaz/ui';
import { Link } from '@/i18n/navigation';
import { getSession } from '@/server/session';

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('dashboard');
  const session = await getSession();
  const name = session?.profile?.fullName ?? null;

  const summaries = [
    { icon: Bookmark, label: t('savedProperties'), empty: t('emptySaved') },
    { icon: Building2, label: t('myListings'), empty: t('emptyListings') },
    { icon: FileText, label: t('offersMade'), empty: t('emptyOffersMade') },
    { icon: Inbox, label: t('offersReceived'), empty: t('emptyOffersReceived') },
    { icon: Receipt, label: t('transactions'), empty: t('emptyTransactions') },
    { icon: Bell, label: t('notifications'), empty: t('emptyNotifications') },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {name ? t('welcome', { name }) : t('welcomeNoName')}
        </h1>
        <p className="mt-1 text-muted-foreground">{t('subtitle')}</p>
      </div>

      {/* Both primary journeys on one account — no Buyer/Seller selection. */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('browseTitle')}</CardTitle>
            <CardDescription>{t('browseBody')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/properties">
                {t('browseCta')}
                <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden />
              </Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t('listTitle')}</CardTitle>
            <CardDescription>{t('listBody')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="secondary">
              <Link href="/sell">
                {t('listCta')}
                <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">{t('summaryTitle')}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {summaries.map(({ icon: Icon, label, empty }) => (
            <Card key={label}>
              <CardHeader className="flex-row items-center gap-2 space-y-0 pb-2">
                <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
                <CardTitle className="text-sm font-medium">{label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{empty}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
