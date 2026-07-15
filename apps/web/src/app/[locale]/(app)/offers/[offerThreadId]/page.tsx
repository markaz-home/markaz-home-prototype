import { setRequestLocale } from 'next-intl/server';
import { OfferThread } from '@/components/offers/offer-thread';

export default async function OfferThreadPage({
  params,
}: {
  params: Promise<{ locale: string; offerThreadId: string }>;
}) {
  const { locale, offerThreadId } = await params;
  setRequestLocale(locale);
  return <OfferThread threadId={offerThreadId} />;
}
