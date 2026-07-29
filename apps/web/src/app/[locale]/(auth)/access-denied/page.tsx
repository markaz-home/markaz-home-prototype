import { setRequestLocale, getTranslations } from 'next-intl/server';
import { AuthShell } from '@/components/auth/auth-shell';
import { ErrorPanel } from '@/components/auth/status-panels';
import { SignOutButton } from '@/components/sign-out-button';

/**
 * Neutral customer-app denial. This deliberately contains no Operations URL,
 * route name or navigation: the admin portal remains a separate application.
 */
export default async function AccessDeniedPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('customerAccessDenied');

  return (
    <AuthShell narrow>
      <ErrorPanel variant="denied" title={t('title')} description={t('body')}>
        <SignOutButton />
      </ErrorPanel>
    </AuthShell>
  );
}
