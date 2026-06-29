import { setRequestLocale } from 'next-intl/server';
import { ListingResolver } from '@/components/sell/steps/rest';

export default async function Page({ params }: { params: Promise<{ locale: string; listingId: string }> }) {
  const { locale, listingId } = await params;
  setRequestLocale(locale);
  return <ListingResolver listingId={listingId} />;
}
