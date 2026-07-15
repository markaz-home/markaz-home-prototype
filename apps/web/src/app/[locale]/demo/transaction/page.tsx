import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { TransactionDemo } from '@/components/demo/transaction-demo';

/**
 * DEV-ONLY Week-5 transaction preview (offers handoff). Isolated + deletable.
 * Hidden in production: returns 404 when DEMO_ENVIRONMENT=production (the same
 * non-production convention used by the demo-auth fallback and db provisioning).
 */
export default async function TransactionDemoPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  if ((process.env.DEMO_ENVIRONMENT ?? '').toLowerCase() === 'production') notFound();
  const { locale } = await params;
  setRequestLocale(locale);
  return <TransactionDemo />;
}
