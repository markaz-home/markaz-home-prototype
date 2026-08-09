import { redirect } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { getServerApi } from '@/server/api';
import { slugForStage } from '@/lib/transaction-routes';

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; transactionId: string }>;
}) {
  const { locale, transactionId } = await params;
  setRequestLocale(locale);
  const api = await getServerApi();
  const transaction = await api.transactions.get({ transactionId });
  redirect(`/${locale}/transactions/${transactionId}/${slugForStage(transaction.activeStage)}`);
}
