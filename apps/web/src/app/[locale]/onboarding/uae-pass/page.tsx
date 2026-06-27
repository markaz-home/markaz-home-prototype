import { setRequestLocale } from 'next-intl/server';
import { requireCustomerStep } from '@/server/session';
import { UaePassFlow } from '@/components/uae-pass-flow';

export default async function UaePassPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireCustomerStep(locale, ['uae-pass']);
  const status = session.profile?.identityVerificationStatus ?? 'NOT_STARTED';
  return <UaePassFlow initialStatus={status} />;
}
