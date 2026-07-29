import { setRequestLocale, getTranslations } from 'next-intl/server';
import { MarketplaceHeader } from '@/components/marketplace/marketplace-header';
import { PublicFooter } from '@/components/marketplace/public-footer';
import { WorkspaceShell } from '@/components/workspace-shell';
import { getSession } from '@/server/session';

/**
 * Marketplace chrome. The pages are public (anonymous visitors may browse), but a
 * signed-in customer stays inside their workspace: same sidebar as /dashboard, so
 * "Browse Properties" is a move within the app, not a step outside it. Anonymous
 * visitors get the public header + footer instead. No auth guard either way.
 */
export default async function MarketplaceLayout({
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

  const skipLink = (
    <a
      href="#main"
      className="focus:bg-background sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-3"
    >
      {t('skipToContent')}
    </a>
  );

  // An ADMIN browsing the marketplace stays in the public chrome — the
  // workspace shell is a customer surface.
  if (session && session.profile?.accountType !== 'ADMIN') {
    return (
      <div className="theme-platform-gold min-h-dvh">
        {skipLink}
        {/* The marketplace pages bring their own `container`, so no shell padding. */}
        <WorkspaceShell displayName={session.profile?.fullName ?? null} padded={false}>
          {children}
        </WorkspaceShell>
      </div>
    );
  }

  return (
    <div className="theme-platform-gold flex min-h-dvh flex-col">
      {skipLink}
      <MarketplaceHeader isAuthenticated={false} displayName={null} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <PublicFooter isAuthenticated={false} />
    </div>
  );
}
