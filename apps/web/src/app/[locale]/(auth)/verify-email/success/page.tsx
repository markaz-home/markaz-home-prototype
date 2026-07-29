import { setRequestLocale, getTranslations } from 'next-intl/server';
import { resolvePostAuthDestination } from '@markaz/domain';
import { getUaePassMode } from '@markaz/auth/uae-pass/server';
import { Button } from '@markaz/ui';
import { Link } from '@/i18n/navigation';
import { AuthShell } from '@/components/auth/auth-shell';
import { SuccessPanel } from '@/components/auth/status-panels';
import { getSession } from '@/server/session';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('verify');
  const session = await getSession();
  const dest = resolvePostAuthDestination({
    emailVerified: session?.emailVerified ?? false,
    identityAuthenticatedByProvider: session?.uaePassAuthenticated ?? false,
    profile: session?.profile ?? null,
  });
  const href =
    dest === 'profile-setup'
      ? '/onboarding/profile'
      : dest === 'dashboard'
        ? '/dashboard'
        : '/onboarding/uae-pass';
  const continuesToDashboard =
    dest === 'dashboard' || (dest === 'uae-pass' && getUaePassMode() === 'simulated');
  const label =
    dest === 'profile-setup'
      ? t('completeProfile')
      : continuesToDashboard
        ? t('continueDashboard')
        : t('continueIdentity');
  const body =
    dest === 'profile-setup'
      ? t('profileSuccessBody')
      : continuesToDashboard
        ? t('demoSuccessBody')
        : t('successBody');
  return (
    <AuthShell narrow>
      <SuccessPanel title={t('successTitle')} description={body}>
        <Button asChild className="mt-2 w-full">
          <Link href={href}>{label}</Link>
        </Button>
      </SuccessPanel>
    </AuthShell>
  );
}
