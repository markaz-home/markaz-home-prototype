import { setRequestLocale, getTranslations } from 'next-intl/server';
import { ShieldAlert } from 'lucide-react';
import { AdminAuthShell, AdminHeading } from '@/components/auth/admin-auth-shell';
import { AdminSignOut } from '@/components/admin-sign-out';

export default async function AccessDeniedPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('admin');
  const webUrl = process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000';
  return (
    <AdminAuthShell>
      <div className="space-y-5">
        <ShieldAlert className="text-destructive h-9 w-9" aria-hidden />
        <AdminHeading title={t('deniedTitle')} description={t('deniedBody')} />
        <p className="text-muted-foreground text-sm">{t('deniedHelp')}</p>
        <div className="flex flex-col gap-3 pt-2">
          <AdminSignOut variant="outline" />
          <a
            href={webUrl}
            className="text-muted-foreground hover:text-foreground text-center text-sm"
          >
            {t('returnHome')}
          </a>
        </div>
      </div>
    </AdminAuthShell>
  );
}
