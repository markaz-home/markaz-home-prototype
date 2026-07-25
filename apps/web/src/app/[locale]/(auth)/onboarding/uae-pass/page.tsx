import { setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { isIdentityVerified } from '@markaz/domain';
import { isUaePassStagingEnabled } from '@markaz/auth/uae-pass/server';
import { requireCustomerStep } from '@/server/session';
import { UaePassFlow } from '@/components/uae-pass-flow';
import { parseUaePassLinkNotice } from '@/lib/uae-pass-link';

export default async function UaePassPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  // A successful link already satisfies the provider-based routing gate, which
  // resolves to dashboard. Permit that destination here so the returned page can
  // persist the display/audit status before the customer continues.
  const session = await requireCustomerStep(locale, ['uae-pass', 'dashboard']);
  const status = session.profile?.identityVerificationStatus ?? 'NOT_STARTED';
  if (
    status === 'VERIFIED_DEMO' ||
    (!session.uaePassAuthenticated && isIdentityVerified(status))
  ) {
    redirect(`/${locale}/dashboard`);
  }

  const notice = parseUaePassLinkNotice((await searchParams).notice);
  return (
    <UaePassFlow
      initialStatus={status}
      providerLinked={session.uaePassAuthenticated}
      uaePassStaging={isUaePassStagingEnabled()}
      locale={locale}
      notice={notice}
    />
  );
}
