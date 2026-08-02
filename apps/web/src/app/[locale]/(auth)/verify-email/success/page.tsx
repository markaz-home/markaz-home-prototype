import { setRequestLocale, getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { resolvePostAuthDestination } from '@markaz/domain';
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
  if (!session) redirect(`/${locale}/sign-in`);
  if (dest === 'verify-email') {
    redirect(`/${locale}/verify-email?email=${encodeURIComponent(session.email ?? '')}`);
  }
  const needsProfile = dest === 'profile-setup';
  const href = needsProfile ? '/onboarding/profile' : '/dashboard';
  const label = needsProfile ? t('completeProfile') : t('continueDashboard');
  const body = needsProfile ? t('profileSuccessBody') : t('successBody');
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
