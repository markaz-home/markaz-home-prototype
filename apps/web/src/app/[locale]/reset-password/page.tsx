import { Suspense } from 'react';
import { setRequestLocale } from 'next-intl/server';
import { ResetPasswordForm } from '@/components/reset-password-form';

export default async function ResetPasswordPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
