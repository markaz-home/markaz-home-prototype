'use client';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { LanguageSwitcher } from '@/components/language-switcher';
import { BrandLogo } from '@/components/brand-logo';
import { BodyTheme } from '@/components/theme/body-theme';

const LEGAL = { terms: '#terms', privacy: '#privacy' };

/**
 * Persistent customer-auth chrome (design spec §9). Rendered ONCE around every
 * auth/onboarding screen so the header, footer, language control, and background
 * stay mounted across navigations — only the page content swaps (no flicker).
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('auth');
  const common = useTranslations('common');
  return (
    <div className="theme-platform-gold flex min-h-dvh flex-col">
      <BodyTheme className="theme-platform-gold" />
      <a
        href="#main"
        className="focus:bg-primary focus:text-primary-foreground sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded focus:px-3 focus:py-2"
      >
        {common('skipToContent')}
      </a>
      <header className="bg-background/85 border-b backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center" aria-label={common('appName')}>
            <BrandLogo />
          </Link>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <Link
              href="/"
              className="text-muted-foreground hover:text-foreground hidden text-sm sm:inline"
            >
              {t('returnHome')}
            </Link>
          </div>
        </div>
      </header>

      <main id="main" className="flex-1">
        {children}
      </main>

      <footer className="bg-card/30 border-t">
        <div className="text-muted-foreground container flex flex-wrap items-center gap-x-5 gap-y-2 py-6 text-xs">
          <a href={LEGAL.terms} target="_blank" rel="noreferrer" className="hover:text-foreground">
            {t('termsOfUse')}
          </a>
          <a
            href={LEGAL.privacy}
            target="_blank"
            rel="noreferrer"
            className="hover:text-foreground"
          >
            {t('privacyPolicy')}
          </a>
          <span className="ms-auto">{t('copyright')}</span>
        </div>
      </footer>
    </div>
  );
}
