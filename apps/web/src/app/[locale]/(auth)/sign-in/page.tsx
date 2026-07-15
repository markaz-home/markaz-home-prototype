import { Suspense } from 'react';
import { setRequestLocale } from 'next-intl/server';
import { isUaePassStagingEnabled } from '@markaz/auth/uae-pass';
import { SignInForm } from '@/components/sign-in-form';

export default async function SignInPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  // Server-controlled: the UAE PASS Staging option appears only in staging mode.
  const uaePassStaging = isUaePassStagingEnabled();
  return (
    <Suspense>
      <SignInForm uaePassStaging={uaePassStaging} locale={locale} />
    </Suspense>
  );
}
