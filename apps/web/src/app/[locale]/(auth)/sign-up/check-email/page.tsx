import { Suspense } from 'react';
import { setRequestLocale } from 'next-intl/server';
import { CheckEmail } from '@/components/check-email';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <Suspense>
      <CheckEmail />
    </Suspense>
  );
}
