import { MapPin } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { BrandLogo } from '@/components/brand-logo';

export function PublicFooter({ isAuthenticated }: { isAuthenticated: boolean }) {
  const t = useTranslations('footer');
  const year = new Date().getFullYear();
  const accountHref = isAuthenticated ? '/dashboard' : '/sign-in';

  return (
    <footer className="border-t border-white/10 bg-[#090909]">
      <div className="container py-12 md:py-14">
        <div className="grid gap-10 md:grid-cols-[minmax(0,1.5fr)_minmax(10rem,0.65fr)_minmax(15rem,0.85fr)] md:gap-12">
          <div className="max-w-sm">
            <Link href="/" aria-label={t('home')}>
              <BrandLogo priority={false} className="h-8 md:h-9" />
            </Link>
            <p className="text-muted-foreground mt-5 text-sm leading-6">{t('tagline')}</p>
            <p className="text-muted-foreground mt-5 flex items-center gap-2 text-xs">
              <MapPin className="text-primary h-4 w-4 shrink-0" aria-hidden />
              {t('location')}
            </p>
          </div>

          <nav aria-label={t('navigationLabel')}>
            <h2 className="text-primary text-xs font-semibold uppercase tracking-[0.18em]">
              {t('quickLinks')}
            </h2>
            <ul className="mt-5 space-y-3 text-sm">
              <li>
                <Link
                  href="/how-it-works"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  {t('howItWorks')}
                </Link>
              </li>
              <li>
                <Link
                  href="/properties"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  {t('browseProperties')}
                </Link>
              </li>
              <li>
                <Link
                  href={isAuthenticated ? '/sell' : '/sign-in?next=/sell'}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  {t('listProperty')}
                </Link>
              </li>
              <li>
                <Link
                  href={accountHref}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  {isAuthenticated ? t('dashboard') : t('signIn')}
                </Link>
              </li>
            </ul>
          </nav>

          <div>
            <h2 className="text-primary text-xs font-semibold uppercase tracking-[0.18em]">
              {t('support')}
            </h2>
            <p className="text-muted-foreground mt-5 max-w-xs text-sm leading-6">
              {t('contactBody')}
            </p>
          </div>
        </div>

        <div className="text-muted-foreground mt-10 flex flex-col gap-3 border-t border-white/10 pt-6 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p>{t('copyright', { year })}</p>
          <p>{t('demoNotice')}</p>
        </div>
      </div>
    </footer>
  );
}
