'use client';
import { ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { LanguageSwitcher } from '@/components/language-switcher';

/**
 * Persistent MARKAZ Operations auth chrome (design spec §18.1): deep-blue band,
 * "Authorised access only", language control. Rendered once around every admin
 * auth screen so it doesn't re-mount between navigations.
 */
export default function AdminAuthLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('admin');
  return (
    <div className="flex min-h-dvh flex-col bg-background lg:flex-row">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <aside className="flex flex-col justify-between bg-brand-900 p-8 text-brand-100 lg:w-2/5 lg:p-12">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 font-semibold text-white">
            <ShieldCheck className="h-5 w-5 text-brand-300" aria-hidden /> {t('brand')}
          </span>
          <LanguageSwitcher />
        </div>
        <div className="hidden lg:block">
          <p className="font-display text-2xl font-medium text-white">{t('brand')}</p>
          <p className="mt-2 text-sm text-brand-300">{t('authorised')}</p>
        </div>
        <p className="mt-8 text-xs text-brand-300 lg:mt-0">{t('authorised')}</p>
      </aside>
      <main id="main" className="flex flex-1 flex-col">
        {children}
      </main>
    </div>
  );
}
