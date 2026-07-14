import { setRequestLocale } from 'next-intl/server';
import { PreviewScreen } from '@/components/sell/steps/rest';

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; listingId: string }>;
}) {
  const { locale, listingId } = await params;
  setRequestLocale(locale);
  return <PreviewScreen listingId={listingId} />;
}
