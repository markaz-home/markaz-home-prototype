import { setRequestLocale } from 'next-intl/server';
import { isGoogleAuthEnabled } from '@markaz/auth/providers/server';
import { isUaePassStagingEnabled } from '@markaz/auth/uae-pass/server';
import { SignUpForm } from '@/components/sign-up-form';

export default async function SignUpPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const googleEnabled = await isGoogleAuthEnabled();
  return (
    <SignUpForm
      locale={locale}
      googleEnabled={googleEnabled}
      uaePassEnabled={isUaePassStagingEnabled()}
    />
  );
}
