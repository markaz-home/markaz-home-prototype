import { setRequestLocale } from 'next-intl/server';
import { getTranslations } from 'next-intl/server';
import { Briefcase, Home, ShieldCheck } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@markaz/ui';
import { Link } from '@/i18n/navigation';
import { LanguageSwitcher } from '@/components/language-switcher';
import { BrandLogo } from '@/components/brand-logo';

export default async function LandingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('landing');

  const points = [
    { icon: Home, title: t('pointBrowseTitle'), body: t('pointBrowseBody') },
    { icon: Briefcase, title: t('pointListTitle'), body: t('pointListBody') },
    { icon: ShieldCheck, title: t('pointSecureTitle'), body: t('pointSecureBody') },
  ];

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" aria-label="MARKAZ Home" className="flex items-center">
            <BrandLogo />
          </Link>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Button asChild variant="ghost" size="sm">
              <Link href="/sign-in">{t('signIn')}</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="container flex-1 py-16">
        <section className="mx-auto max-w-3xl text-center">
          <h1 className="font-display text-brand-900 text-balance text-4xl font-medium leading-[1.08] tracking-tight sm:text-5xl md:text-6xl">
            {t('title')}
          </h1>
          <p className="text-muted-foreground mx-auto mt-6 max-w-2xl text-pretty text-lg">
            {t('subtitle')}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/properties">{t('ctaBrowse')}</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/sign-in">{t('ctaList')}</Link>
            </Button>
          </div>
        </section>

        <section className="mx-auto mt-16 grid max-w-4xl gap-4 sm:grid-cols-3">
          {points.map(({ icon: Icon, title, body }) => (
            <Card key={title}>
              <CardHeader>
                <Icon className="text-primary h-6 w-6" aria-hidden />
                <CardTitle className="text-base">{title}</CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground text-sm">{body}</CardContent>
            </Card>
          ))}
        </section>
      </main>
    </div>
  );
}
