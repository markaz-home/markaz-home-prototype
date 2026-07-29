import { setRequestLocale, getTranslations } from 'next-intl/server';
import { requireCustomerStep } from '@/server/session';
import { WorkspaceShell } from '@/components/workspace-shell';
import { SaveIntentRedirect } from '@/components/marketplace/save-intent-redirect';
import { OfferIntentRedirect } from '@/components/offers/offer-intent-redirect';

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('common');
  // One guard for every authenticated page: must be a fully-onboarded customer.
  const session = await requireCustomerStep(locale, ['dashboard']);

  // Keep the authenticated workspace on the same Platform Gold foundation as
  // the public and authentication journeys.
  return (
    <div className="theme-platform-gold min-h-dvh">
      <a
        href="#main"
        className="focus:bg-background sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-3"
      >
        {t('skipToContent')}
      </a>
      <SaveIntentRedirect />
      <OfferIntentRedirect />
      <WorkspaceShell displayName={session.profile?.fullName ?? null}>{children}</WorkspaceShell>
    </div>
  );
}
