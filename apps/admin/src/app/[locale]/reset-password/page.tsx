import { Suspense } from 'react';
import { setRequestLocale } from 'next-intl/server';
import { AdminResetPassword } from '@/components/admin-reset-password';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <Suspense>
      <AdminResetPassword />
    </Suspense>
  );
}
