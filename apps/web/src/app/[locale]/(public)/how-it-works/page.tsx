import { Building2, Handshake, KeyRound, Search, ShieldCheck, UserRoundCheck } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@markaz/ui';
import { Link } from '@/i18n/navigation';

export default async function HowItWorksPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('howItWorks');

  const buyerSteps = [
    { icon: Search, title: t('buyer.searchTitle'), body: t('buyer.searchBody') },
    { icon: Handshake, title: t('buyer.offerTitle'), body: t('buyer.offerBody') },
    { icon: KeyRound, title: t('buyer.trackTitle'), body: t('buyer.trackBody') },
  ];
  const sellerSteps = [
    { icon: Building2, title: t('seller.listTitle'), body: t('seller.listBody') },
    { icon: ShieldCheck, title: t('seller.reviewTitle'), body: t('seller.reviewBody') },
    { icon: UserRoundCheck, title: t('seller.manageTitle'), body: t('seller.manageBody') },
  ];

  return (
    <main>
      <section className="bg-muted/40 border-b">
        <div className="container max-w-5xl py-14 text-center md:py-20">
          <p className="text-primary text-xs font-semibold uppercase tracking-[0.2em]">
            {t('eyebrow')}
          </p>
          <h1 className="font-display mt-4 text-4xl font-semibold md:text-6xl">{t('title')}</h1>
          <p className="text-muted-foreground mx-auto mt-5 max-w-2xl text-lg">{t('description')}</p>
        </div>
      </section>

      <div className="container max-w-6xl space-y-14 py-14">
        <Journey title={t('buyer.title')} steps={buyerSteps} />
        <Journey title={t('seller.title')} steps={sellerSteps} />

        <section className="bg-card rounded-xl border p-8 text-center">
          <h2 className="font-display text-3xl font-semibold">{t('simulationTitle')}</h2>
          <p className="text-muted-foreground mx-auto mt-3 max-w-2xl">{t('simulationBody')}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link href="/properties">{t('browseAction')}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/sign-up">{t('accountAction')}</Link>
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}

function Journey({
  title,
  steps,
}: {
  title: string;
  steps: Array<{ icon: typeof Search; title: string; body: string }>;
}) {
  return (
    <section>
      <h2 className="font-display text-3xl font-semibold">{title}</h2>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {steps.map(({ icon: Icon, title: stepTitle, body }, index) => (
          <Card key={stepTitle}>
            <CardHeader>
              <div className="bg-primary/10 text-primary mb-3 flex h-10 w-10 items-center justify-center rounded-full">
                <Icon className="h-5 w-5" aria-hidden />
              </div>
              <p className="text-muted-foreground text-xs font-semibold">
                {String(index + 1).padStart(2, '0')}
              </p>
              <CardTitle>{stepTitle}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm leading-6">{body}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
