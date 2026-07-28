import { setRequestLocale, getTranslations } from 'next-intl/server';
import { MarketplaceHeader } from '@/components/marketplace/marketplace-header';
import { PublicFooter } from '@/components/marketplace/public-footer';
import { BodyTheme } from '@/components/theme/body-theme';
import { getSession } from '@/server/session';

/**
 * Public marketplace chrome (design spec §11). No auth guard — anonymous
 * visitors may browse. The header adapts to the session if one exists.
 */
export default async function PublicLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('common');
  const session = await getSession();

  return (
    <div className="theme-platform-gold flex min-h-dvh flex-col">
      <BodyTheme className="theme-platform-gold" />
      <a
        href="#main"
        className="focus:bg-background sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-3"
      >
        {t('skipToContent')}
      </a>
      {/* Operations accounts are signed in but are not customers, so they get
          the anonymous chrome rather than customer navigation. */}
      <MarketplaceHeader
        isAuthenticated={!!session && session.profile?.accountType !== 'ADMIN'}
        displayName={session?.profile?.fullName ?? null}
      />
      <main id="main" className="flex-1">
        {children}
      </main>
      <PublicFooter isAuthenticated={!!session && session.profile?.accountType !== 'ADMIN'} />
    </div>
  );
}
