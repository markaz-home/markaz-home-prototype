import { setRequestLocale } from 'next-intl/server';
import { PublicationStatus } from '@/components/sell/publication-status';

export default async function Page({ params }: { params: Promise<{ locale: string; listingId: string }> }) {
  const { locale, listingId } = await params;
  setRequestLocale(locale);
  return <PublicationStatus listingId={listingId} />;
}
