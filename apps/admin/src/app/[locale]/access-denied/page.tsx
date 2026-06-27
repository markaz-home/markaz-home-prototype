import { setRequestLocale, getTranslations } from 'next-intl/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@markaz/ui';
import { ShieldAlert } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { AdminSignOut } from '@/components/admin-sign-out';

export default async function AccessDeniedPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('admin');
  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <ShieldAlert className="h-6 w-6 text-destructive" aria-hidden />
          <CardTitle>{t('accessDeniedTitle')}</CardTitle>
          <CardDescription>{t('accessDeniedBody')}</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <Link href="/login" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
            {t('backToLogin')}
          </Link>
          <AdminSignOut variant="outline" />
        </CardContent>
      </Card>
    </div>
  );
}
