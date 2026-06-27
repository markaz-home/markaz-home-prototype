import { setRequestLocale } from 'next-intl/server';
import { Placeholder } from '@/components/placeholder';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <Placeholder titleKey="notificationsTitle" bodyKey="notificationsBody" />;
}
