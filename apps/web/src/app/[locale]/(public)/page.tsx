import { setRequestLocale } from 'next-intl/server';
import { getTranslations } from 'next-intl/server';
import { Briefcase, Home, ShieldCheck } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@markaz/ui';
import { Link } from '@/i18n/navigation';
import { FeaturedProperties } from '@/components/landing/featured-properties';

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
    <div className="overflow-hidden">
      <section className="container relative py-16 md:py-24 lg:py-28">
        <div className="grid items-center gap-14 lg:grid-cols-[1.08fr_0.92fr] lg:gap-20">
          <div className="relative z-10 max-w-3xl">
            <p className="text-primary mb-5 text-xs font-semibold uppercase tracking-[0.22em]">
              {t('eyebrow')}
            </p>
            <h1 className="font-display text-primary text-balance text-4xl font-medium leading-[1.04] tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
              {t('title')}
            </h1>
            <p className="text-muted-foreground mt-7 max-w-2xl text-pretty text-lg leading-relaxed md:text-xl">
              {t('subtitle')}
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/properties">{t('ctaBrowse')}</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/sign-in?next=/sell">{t('ctaList')}</Link>
              </Button>
            </div>
          </div>

          <div
            className="platform-gold-hero-art border-primary/25 relative mx-auto aspect-[4/3] w-full max-w-xl overflow-hidden rounded-xl border"
            aria-hidden
          >
            <div className="border-primary/45 absolute inset-x-[9%] bottom-0 h-[76%] border-x border-t" />
            <div className="border-primary/30 absolute inset-x-[19%] bottom-0 h-[90%] border-x border-t" />
            <div className="border-primary/65 absolute inset-x-[31%] bottom-0 h-[62%] rounded-t-[999px] border-x border-t" />
            <div className="border-primary/45 absolute inset-x-[39%] bottom-0 h-[42%] rounded-t-[999px] border-x border-t" />
            <div className="bg-primary/20 absolute inset-x-0 bottom-[16%] h-px" />
            <div className="bg-primary/15 absolute inset-x-0 bottom-[32%] h-px" />
            <div className="bg-primary/10 absolute inset-x-0 bottom-[48%] h-px" />
            <div className="border-primary/20 absolute end-[8%] top-[8%] h-20 w-20 rounded-full border" />
            <div className="bg-primary/10 absolute end-[12%] top-[12%] h-12 w-12 rounded-full blur-xl" />
          </div>
        </div>
      </section>

      <div className="container">
        <FeaturedProperties />

        <section className="mx-auto my-20 grid max-w-5xl gap-4 sm:grid-cols-3">
          {points.map(({ icon: Icon, title, body }) => (
            <Card key={title} className="bg-card/70 border-primary/15 backdrop-blur-sm">
              <CardHeader>
                <span className="border-primary/25 flex h-11 w-11 items-center justify-center rounded-full border">
                  <Icon className="text-primary h-5 w-5" aria-hidden />
                </span>
                <CardTitle className="pt-3 text-base">{title}</CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground text-sm leading-relaxed">
                {body}
              </CardContent>
            </Card>
          ))}
        </section>
      </div>
    </div>
  );
}
