import { redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { TRPCError } from '@trpc/server';
import { Button, ErrorState } from '@markaz/ui';
import { Link } from '@/i18n/navigation';
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
  let transaction: Awaited<ReturnType<typeof api.transactions.get>>;
  try {
    transaction = await api.transactions.get({ transactionId });
  } catch (error) {
    if (!(error instanceof TRPCError) || error.code !== 'NOT_FOUND') throw error;

    const t = await getTranslations('transactions');
    return (
      <div className="mx-auto max-w-md space-y-4 py-12">
        <ErrorState title={t('unavailable.title')} description={t('unavailable.body')} />
        <Button asChild variant="outline" className="w-full">
          <Link href="/transactions">{t('backToList')}</Link>
        </Button>
      </div>
    );
  }
  redirect(`/${locale}/transactions/${transactionId}/${slugForStage(transaction.activeStage)}`);
}
