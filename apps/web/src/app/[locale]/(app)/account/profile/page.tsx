import { setRequestLocale } from 'next-intl/server';
import { isUaePassStagingEnabled } from '@markaz/auth/uae-pass/server';
import { AccountProfile } from '@/components/account-profile';
import { parseUaePassProfileNotice } from '@/lib/uae-pass-link';
import { getSession } from '@/server/session';

export default async function AccountProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ uae_pass?: string | string[] }>;
}) {
  const { locale } = await params;
  const query = await searchParams;
  setRequestLocale(locale);
  const session = await getSession();
  const profile = session?.profile;
  const uaePassLinked =
    !!session?.uaePassAuthenticated || profile?.identityVerificationStatus === 'VERIFIED_STAGING';

  return (
    <AccountProfile
      fullName={profile?.fullName ?? null}
      email={session?.email ?? profile?.email ?? null}
      locale={locale}
      emailVerified={session?.emailVerified ?? false}
      uaePassLinked={uaePassLinked}
      uaePassStaging={isUaePassStagingEnabled()}
      initialNotice={parseUaePassProfileNotice(query.uae_pass)}
    />
  );
}
