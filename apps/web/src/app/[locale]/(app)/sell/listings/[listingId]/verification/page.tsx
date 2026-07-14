import { setRequestLocale } from 'next-intl/server';
import { VerificationStep } from '@/components/sell/steps/rest';

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; listingId: string }>;
}) {
  const { locale, listingId } = await params;
  setRequestLocale(locale);
  return <VerificationStep listingId={listingId} />;
}
