import { setRequestLocale } from 'next-intl/server';
import { RealtimeProof } from '@/components/realtime-proof';

export default async function RealtimeProofPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <RealtimeProof />;
}
