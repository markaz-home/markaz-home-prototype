import { setRequestLocale } from 'next-intl/server';
import { PublishFlow } from '@/components/sell/publish-flow';

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; listingId: string }>;
}) {
  const { locale, listingId } = await params;
  setRequestLocale(locale);
  return <PublishFlow listingId={listingId} />;
}
