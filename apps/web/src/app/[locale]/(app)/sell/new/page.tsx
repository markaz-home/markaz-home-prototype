import { setRequestLocale } from 'next-intl/server';
import { NewListingPreflight } from '@/components/sell/steps/rest';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <NewListingPreflight />;
}
