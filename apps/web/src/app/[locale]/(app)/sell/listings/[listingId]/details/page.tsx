import { setRequestLocale } from 'next-intl/server';
import { DetailsStep } from '@/components/sell/steps/details';

export default async function Page({ params }: { params: Promise<{ locale: string; listingId: string }> }) {
  const { locale, listingId } = await params;
  setRequestLocale(locale);
  return <DetailsStep listingId={listingId} />;
}
