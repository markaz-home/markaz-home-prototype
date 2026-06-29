import { Suspense } from 'react';
import { setRequestLocale } from 'next-intl/server';
import { VerifyEmailForm } from '@/components/verify-email-form';

export default async function VerifyEmailPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <Suspense>
      <VerifyEmailForm />
    </Suspense>
  );
}
