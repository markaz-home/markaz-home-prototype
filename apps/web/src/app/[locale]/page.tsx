import { setRequestLocale } from 'next-intl/server';
import { getTranslations } from 'next-intl/server';
import { Briefcase, Home, ShieldCheck } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@markaz/ui';
import { Link } from '@/i18n/navigation';
import { LanguageSwitcher } from '@/components/language-switcher';

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
          <span className="flex items-center gap-2 font-semibold">
            <Home className="h-5 w-5 text-primary" aria-hidden />
            MARKAZ Home
          </span>
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
          <h1 className="text-balance font-display text-4xl font-medium leading-[1.08] tracking-tight text-brand-900 sm:text-5xl md:text-6xl">
            {t('title')}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-muted-foreground">
            {t('subtitle')}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/sign-in">{t('ctaBrowse')}</Link>
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
                <Icon className="h-6 w-6 text-primary" aria-hidden />
                <CardTitle className="text-base">{title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{body}</CardContent>
            </Card>
          ))}
        </section>
      </main>
    </div>
  );
}
