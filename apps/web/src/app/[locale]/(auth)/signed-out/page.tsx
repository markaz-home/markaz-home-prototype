import { setRequestLocale, getTranslations } from 'next-intl/server';
import { Button } from '@markaz/ui';
import { Link } from '@/i18n/navigation';
import { AuthShell } from '@/components/auth/auth-shell';
import { SuccessPanel } from '@/components/auth/status-panels';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('session');
  const ta = await getTranslations('auth');
  return (
    <AuthShell narrow>
      <SuccessPanel title={t('signedOutTitle')} description={t('signedOutBody')}>
        <div className="flex flex-col gap-3 pt-2">
          <Button asChild>
            <Link href="/sign-in">{ta('signIn')}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/browse">{t('browse')}</Link>
          </Button>
        </div>
      </SuccessPanel>
    </AuthShell>
  );
}
