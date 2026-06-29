import { Suspense } from 'react';
import { setRequestLocale } from 'next-intl/server';
import { AdminSignInFlow } from '@/components/admin-sign-in-flow';

export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <Suspense>
      <AdminSignInFlow />
    </Suspense>
  );
}
