import { setRequestLocale, getTranslations } from 'next-intl/server';
import { Card, CardContent, CardHeader, CardTitle, StatusBadge } from '@markaz/ui';
import { getSession } from '@/server/session';

export default async function AccountProfilePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('placeholders');
  const session = await getSession();
  const profile = session?.profile;

  const verified =
    session?.uaePassAuthenticated || profile?.identityVerificationStatus === 'VERIFIED_DEMO';
  const identityLabel = session?.uaePassAuthenticated
    ? t('identityUaePassStaging')
    : profile?.identityVerificationStatus === 'VERIFIED_DEMO'
      ? t('identityDemo')
      : (profile?.identityVerificationStatus ?? 'NOT_STARTED');

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t('profileTitle')}</h1>
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-base">{profile?.fullName ?? '—'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Row label={t('emailLabel')} value={profile?.email ?? session?.email ?? '—'} />
          <Row label={t('accountTypeLabel')} value={profile?.accountType ?? 'CUSTOMER'} />
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t('identityLabel')}</span>
            <StatusBadge tone={verified ? 'success' : 'warning'}>{identityLabel}</StatusBadge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
