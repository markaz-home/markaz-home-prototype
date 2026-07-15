import { Suspense } from 'react';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { getAuthUser } from '@markaz/auth/server';
import { Button } from '@markaz/ui';
import { Link } from '@/i18n/navigation';
import { AuthShell } from '@/components/auth/auth-shell';
import { ErrorPanel } from '@/components/auth/status-panels';
import { ResetPasswordForm } from '@/components/reset-password-form';

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
    const tf = await getTranslations('forgot');
    return (
      <AuthShell narrow>
        <ErrorPanel title={t('invalidTitle')} description={t('invalidBody')}>
          <div className="flex flex-col gap-3 pt-2">
            <Button asChild>
              <Link href="/forgot-password">{t('requestNew')}</Link>
            </Button>
            <Link
              href="/sign-in"
              className="text-muted-foreground hover:text-foreground text-center text-sm"
            >
              {tf('return')}
            </Link>
          </div>
        </ErrorPanel>
      </AuthShell>
    );
  }
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
