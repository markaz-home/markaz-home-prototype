import { setRequestLocale } from 'next-intl/server';
import { TransactionsHub } from '@/components/transactions/transactions-hub';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <TransactionsHub />;
}
