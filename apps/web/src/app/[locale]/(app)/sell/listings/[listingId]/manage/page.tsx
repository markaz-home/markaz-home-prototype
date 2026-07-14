import { setRequestLocale } from 'next-intl/server';
import { ManageListing } from '@/components/sell/manage-listing';

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; listingId: string }>;
}) {
  const { locale, listingId } = await params;
  setRequestLocale(locale);
  return <ManageListing listingId={listingId} />;
}
