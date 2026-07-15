import { setRequestLocale, getTranslations } from 'next-intl/server';
import { Button } from '@markaz/ui';
import { Link } from '@/i18n/navigation';
import { AdminAuthShell } from '@/components/auth/admin-auth-shell';
import { SuccessPanel } from '@/components/auth/status-panels';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('admin');
  return (
    <AdminAuthShell>
      <SuccessPanel title={t('signedOutTitle')} description={t('signedOutBody')}>
        <Button asChild className="mt-2 w-full">
          <Link href="/login">{t('return')}</Link>
        </Button>
      </SuccessPanel>
    </AdminAuthShell>
  );
}
