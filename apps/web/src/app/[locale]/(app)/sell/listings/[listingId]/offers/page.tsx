import { setRequestLocale } from 'next-intl/server';
import { ListingOffers } from '@/components/offers/listing-offers';

export default async function ListingOffersPage({
  params,
}: {
  params: Promise<{ locale: string; listingId: string }>;
}) {
  const { locale, listingId } = await params;
  setRequestLocale(locale);
  return <ListingOffers listingId={listingId} />;
}
