import { setRequestLocale } from 'next-intl/server';
import { OffersHub } from '@/components/offers/offers-hub';

export default async function OffersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { locale } = await params;
  const { view } = await searchParams;
  setRequestLocale(locale);
  return <OffersHub initialView={view === 'received' ? 'received' : 'made'} />;
}
