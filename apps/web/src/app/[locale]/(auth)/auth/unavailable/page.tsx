import { setRequestLocale, getTranslations } from 'next-intl/server';
import { Button } from '@markaz/ui';
import { Link } from '@/i18n/navigation';
import { AuthShell } from '@/components/auth/auth-shell';
import { ErrorPanel } from '@/components/auth/status-panels';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('error');
  const ta = await getTranslations('auth');
  return (
    <AuthShell narrow>
      <ErrorPanel title={t('providerTitle')} description={t('providerBody')}>
        <Button asChild className="mt-2">
          <Link href="/sign-in">{ta('tryAgain')}</Link>
        </Button>
      </ErrorPanel>
    </AuthShell>
  );
}
