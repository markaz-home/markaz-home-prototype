import { Suspense } from 'react';
import { setRequestLocale } from 'next-intl/server';
import { isGoogleAuthEnabled } from '@markaz/auth/providers/server';
import { isUaePassStagingEnabled } from '@markaz/auth/uae-pass/server';
import { SignInForm } from '@/components/sign-in-form';

export default async function SignInPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  // Server-controlled: the UAE PASS Staging option appears only in staging mode.
  const uaePassStaging = isUaePassStagingEnabled();
  const googleEnabled = await isGoogleAuthEnabled();
  return (
    <Suspense>
      <SignInForm
        uaePassStaging={uaePassStaging}
        googleEnabled={googleEnabled}
        locale={locale}
      />
    </Suspense>
  );
}
