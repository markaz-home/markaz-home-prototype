import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { TransactionWorkspace } from '@/components/transactions/transaction-workspace';
import { stageFromSlug } from '@/lib/transaction-routes';

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; transactionId: string; stage: string }>;
}) {
  const { locale, transactionId, stage } = await params;
  setRequestLocale(locale);
  if (!stageFromSlug(stage)) notFound();
  return <TransactionWorkspace transactionId={transactionId} stageSlug={stage} />;
}
