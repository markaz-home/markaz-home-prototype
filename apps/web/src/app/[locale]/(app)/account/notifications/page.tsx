import { setRequestLocale } from 'next-intl/server';
import { NotificationsList } from '@/components/offers/notifications-list';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <NotificationsList />;
}
