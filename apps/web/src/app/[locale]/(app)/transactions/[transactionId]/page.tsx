import { setRequestLocale } from 'next-intl/server';
import { TransactionWorkspace } from '@/components/transactions/transaction-workspace';

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; transactionId: string }>;
}) {
  const { locale, transactionId } = await params;
  setRequestLocale(locale);
  return <TransactionWorkspace transactionId={transactionId} />;
}
