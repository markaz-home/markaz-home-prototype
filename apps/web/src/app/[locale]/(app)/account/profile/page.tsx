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

  const verified = profile?.identityVerificationStatus === 'VERIFIED_DEMO';

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t('profileTitle')}</h1>
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-base">{profile?.fullName ?? '—'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Row label="Email" value={profile?.email ?? session?.email ?? '—'} />
          <Row label="Account type" value={profile?.accountType ?? 'CUSTOMER'} />
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Identity</span>
            <StatusBadge tone={verified ? 'success' : 'warning'}>
              {verified ? 'Demo identity verified' : (profile?.identityVerificationStatus ?? 'NOT_STARTED')}
            </StatusBadge>
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
