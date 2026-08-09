import { setRequestLocale } from 'next-intl/server';
import { isUaePassStagingEnabled } from '@markaz/auth/uae-pass/server';
import { AccountProfile } from '@/components/account-profile';
import { isCustomerEmailVerified, resolveCustomerEmail } from '@/lib/customer-email';
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
  const email = resolveCustomerEmail(session?.email, profile?.email);
  const emailVerified = isCustomerEmailVerified({
    email,
    authEmailVerified: session?.emailVerified ?? false,
    uaePassAuthenticated: session?.uaePassAuthenticated ?? false,
    emailPasswordAuthenticated: session?.emailPasswordAuthenticated ?? false,
  });
  const uaePassLinked =
    !!session?.uaePassAuthenticated || profile?.identityVerificationStatus === 'VERIFIED_STAGING';
  const uaePassSyncPending =
    !!session?.uaePassAuthenticated && profile?.identityVerificationStatus !== 'VERIFIED_STAGING';

  return (
    <AccountProfile
      fullName={profile?.fullName ?? null}
      email={email}
      phoneE164={profile?.phoneE164 ?? null}
      phoneVerified={!!profile?.phoneVerifiedAt}
      locale={locale}
      emailVerified={emailVerified}
      emailPasswordLinked={session?.emailPasswordAuthenticated ?? false}
      uaePassLinked={uaePassLinked}
      uaePassSyncPending={uaePassSyncPending}
      uaePassStaging={isUaePassStagingEnabled()}
      initialNotice={parseUaePassProfileNotice(query.uae_pass)}
    />
  );
}
