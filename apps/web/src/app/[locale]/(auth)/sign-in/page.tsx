import { Suspense } from 'react';
import { setRequestLocale } from 'next-intl/server';
import { SignInForm } from '@/components/sign-in-form';

export default async function SignInPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}
