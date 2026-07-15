import { setRequestLocale } from 'next-intl/server';
import { RecoveryEmailSent } from '@/components/recovery-sent';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <RecoveryEmailSent />;
}
