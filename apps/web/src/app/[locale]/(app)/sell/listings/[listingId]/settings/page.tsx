import { setRequestLocale } from 'next-intl/server';
import { SettingsStep } from '@/components/sell/steps/rest';

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; listingId: string }>;
}) {
  const { locale, listingId } = await params;
  setRequestLocale(locale);
  return <SettingsStep listingId={listingId} />;
}
