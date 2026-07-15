'use client';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { LanguageSwitcher } from '@/components/language-switcher';
import { BrandLogo } from '@/components/brand-logo';

const LEGAL = { terms: '#terms', privacy: '#privacy' };

/**
 * Persistent customer-auth chrome (design spec §9). Rendered ONCE around every
 * auth/onboarding screen so the header, footer, language control, and background
 * stay mounted across navigations — only the page content swaps (no flicker).
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('auth');
  return (
    <div className="bg-background flex min-h-dvh flex-col">
      <a
        href="#main"
        className="focus:bg-primary focus:text-primary-foreground sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <header className="bg-card border-b">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center" aria-label="MARKAZ Home">
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

      <footer className="border-t">
        <div className="text-muted-foreground container flex flex-wrap items-center gap-x-5 gap-y-2 py-6 text-xs">
          <a href={LEGAL.terms} target="_blank" rel="noreferrer" className="hover:text-foreground">
            Terms of Use
          </a>
          <a
            href={LEGAL.privacy}
            target="_blank"
            rel="noreferrer"
            className="hover:text-foreground"
          >
            Privacy Policy
          </a>
          <span className="ms-auto">© MARKAZ Home</span>
        </div>
      </footer>
    </div>
  );
}
