'use client';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { LanguageSwitcher } from '@/components/language-switcher';

/**
 * Persistent Markaz Operations auth chrome. This ports the approved Platform
 * Gold cover treatment into the real admin app while leaving Supabase auth and
 * the admin-only route boundary untouched. Rendered once so auth navigation
 * swaps only the inner card.
 */
export default function AdminAuthLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('admin');
  const common = useTranslations('common');

  return (
    <div className="theme-platform-gold bg-background relative flex min-h-dvh overflow-hidden">
      <div className="absolute inset-0" aria-hidden>
        <Image
          src="/images/admin-auth-dubai.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,8,8,0.64)_0%,rgba(8,8,8,0.78)_48%,rgba(8,8,8,0.93)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(200,162,122,0.08),transparent_42%)]" />
      </div>

      <a
        href="#main"
        className="focus:bg-primary focus:text-primary-foreground sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded focus:px-3 focus:py-2"
      >
        {common('skipToContent')}
      </a>

      <header className="absolute inset-x-0 top-0 z-20">
        <div className="flex h-20 items-center justify-between px-5 sm:px-8 lg:px-12">
          <Image
            src="/markaz-logo-gold.png"
            alt={common('appName')}
            width={448}
            height={112}
            priority
            className="h-9 w-auto sm:h-10"
          />
          <LanguageSwitcher variant="gold" />
        </div>
      </header>

      <main id="main" className="relative z-10 flex min-h-dvh min-w-0 flex-1 flex-col">
        {children}
      </main>

      <p className="text-muted-foreground absolute inset-x-0 bottom-5 z-20 text-center text-[11px] uppercase tracking-[0.16em]">
        {t('authorised')}
      </p>
    </div>
  );
}
