'use client';
import { Home } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@markaz/ui';
import { Link } from '@/i18n/navigation';
import { LanguageSwitcher } from '@/components/language-switcher';

const LEGAL = { terms: '#terms', privacy: '#privacy' };

/**
 * Customer authentication shell (design spec §9): brand header with language
 * control + return-home, split form/support layout (support hidden < 1024px),
 * legal footer. Skip link + single <main> landmark for a11y.
 */
export function AuthShell({
  children,
  support,
  narrow = false,
}: {
  children: React.ReactNode;
  support?: React.ReactNode;
  narrow?: boolean;
}) {
  const t = useTranslations('auth');
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <header className="border-b bg-card">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold text-brand-900">
            <Home className="h-5 w-5 text-primary" aria-hidden /> MARKAZ Home
          </Link>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <Link
              href="/"
              className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline"
            >
              {t('returnHome')}
            </Link>
          </div>
        </div>
      </header>

      <main id="main" className="container flex-1 py-10 md:py-14">
        <div className="mx-auto grid w-full max-w-6xl gap-10 lg:grid-cols-12 lg:gap-16">
          <div className={cn(support ? 'lg:col-span-7' : 'lg:col-span-12')}>
            <div
              className={cn(
                'mx-auto w-full',
                narrow ? 'max-w-[480px]' : 'max-w-[520px]',
                support && 'lg:ms-0',
              )}
            >
              {children}
            </div>
          </div>
          {support ? <aside className="hidden lg:col-span-5 lg:block">{support}</aside> : null}
        </div>
      </main>

      <footer className="border-t">
        <div className="container flex flex-wrap items-center gap-x-5 gap-y-2 py-6 text-xs text-muted-foreground">
          <a href={LEGAL.terms} target="_blank" rel="noreferrer" className="hover:text-foreground">
            Terms of Use
          </a>
          <a href={LEGAL.privacy} target="_blank" rel="noreferrer" className="hover:text-foreground">
            Privacy Policy
          </a>
          <span className="ms-auto">© MARKAZ Home</span>
        </div>
      </footer>
    </div>
  );
}

/** Heading block for an auth form (progress slot + h1 + description). */
export function AuthHeading({
  title,
  description,
  progress,
}: {
  title: string;
  description?: string;
  progress?: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      {progress}
      <h1 className="font-display text-3xl font-medium tracking-tight text-brand-900">{title}</h1>
      {description ? <p className="text-pretty text-muted-foreground">{description}</p> : null}
    </div>
  );
}
