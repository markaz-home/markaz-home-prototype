import { setRequestLocale, getTranslations } from 'next-intl/server';
import { Button } from '@markaz/ui';
import { Link } from '@/i18n/navigation';
import { AuthShell } from '@/components/auth/auth-shell';
import { SuccessPanel } from '@/components/auth/status-panels';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('reset');
  const ta = await getTranslations('auth');
  return (
    <AuthShell narrow>
      <SuccessPanel title={t('successTitle')} description={t('successBody')}>
        <Button asChild className="mt-2 w-full">
          <Link href="/sign-in">{ta('signIn')}</Link>
        </Button>
      </SuccessPanel>
    </AuthShell>
  );
}
