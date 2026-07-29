import { setRequestLocale } from 'next-intl/server';
import { Portfolio } from '@/components/transactions/portfolio';

export default async function PortfolioPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <Portfolio />;
}
