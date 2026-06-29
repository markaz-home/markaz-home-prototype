import { Suspense } from 'react';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { getAuthUser } from '@markaz/auth/server';
import { Button } from '@markaz/ui';
import { Link } from '@/i18n/navigation';
import { AdminAuthShell, AdminHeading } from '@/components/auth/admin-auth-shell';
import { AdminResetPassword } from '@/components/admin-reset-password';

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const user = await getAuthUser();
  if (sp?.error === 'invalid' || !user) {
    const t = await getTranslations('reset');
    const ta = await getTranslations('admin');
    return (
      <AdminAuthShell>
        <div className="space-y-5">
          <AdminHeading title={t('invalidTitle')} description={t('invalidBody')} />
          <div className="flex flex-col gap-3 pt-2">
            <Button asChild><Link href="/forgot-password">{t('requestNew')}</Link></Button>
            <Link href="/login" className="text-center text-sm text-muted-foreground hover:text-foreground">{ta('returnSignIn')}</Link>
          </div>
        </div>
      </AdminAuthShell>
    );
  }
  return <Suspense><AdminResetPassword /></Suspense>;
}
