import { setRequestLocale } from 'next-intl/server';
import { MyListings } from '@/components/sell/my-listings';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <MyListings />;
}
