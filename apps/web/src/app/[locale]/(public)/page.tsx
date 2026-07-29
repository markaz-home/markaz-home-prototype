import Image from 'next/image';
import { setRequestLocale } from 'next-intl/server';
import { getTranslations } from 'next-intl/server';
import { FeaturedProperties } from '@/components/landing/featured-properties';
import { HeroSearch } from '@/components/landing/hero-search';

export default async function LandingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('landing');

  return (
    // No overflow clipping anywhere above the hero: the search bar's dropdown
    // and suggestion panels have to escape the band.
    <div>
      {/*
       * Hero: full-bleed cover band behind the headline and search. The cover
       * photograph is rendered through Next Image so responsive formats and
       * sizes are generated instead of sending the original asset to everyone.
       * Sized so the featured properties below stay visible above the fold.
       */}
      {/* The explicit z-index raises this isolated stacking context above the
       * following content, so an open search listbox is never painted under it. */}
      <section className="relative isolate z-10 flex min-h-[420px] items-center md:max-h-[640px] md:min-h-[max(460px,calc(64svh-4rem))]">
        {/* -z-10 keeps the band behind the content without clipping the section. */}
        <div aria-hidden className="platform-gold-hero-cover absolute inset-0 -z-10">
          <Image
            src="/images/hero-dubai-balcony.png"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-[68%_center] sm:object-center"
          />
        </div>
        <div aria-hidden className="platform-gold-hero-scrim absolute inset-0 -z-10" />

        <div className="container relative py-12 md:py-14">
          <div className="max-w-3xl">
            <p className="text-primary mb-5 text-xs font-semibold uppercase tracking-[0.22em]">
              {t('eyebrow')}
            </p>
            <h1 className="font-display text-balance text-5xl font-normal leading-[1.02] tracking-tight sm:text-6xl md:text-7xl">
              {t.rich('title', {
                accent: (chunks) => <span className="text-primary">{chunks}</span>,
              })}
            </h1>
            <p className="text-muted-foreground mb-7 mt-5 max-w-xl text-pretty text-base leading-relaxed md:text-lg">
              {t('subtitle')}
            </p>

            <HeroSearch />
          </div>
        </div>
      </section>

      <div className="container pb-20">
        <FeaturedProperties />
      </div>
    </div>
  );
}
