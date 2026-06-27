'use client';
import { ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { LanguageSwitcher } from '@/components/language-switcher';

/**
 * MARKAZ Operations auth shell (design spec §18.1): deep-blue brand band,
 * "Authorised access only", no marketplace nav / no Create Account.
 */
export function AdminAuthShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations('admin');
  return (
    <div className="flex min-h-dvh flex-col bg-background lg:flex-row">
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
      <main id="main" className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-[440px]">{children}</div>
      </main>
    </div>
  );
}

/** Heading block for admin auth. */
export function AdminHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div className="space-y-2">
      <h1 className="font-display text-2xl font-medium tracking-tight text-brand-900">{title}</h1>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
    </div>
  );
}
