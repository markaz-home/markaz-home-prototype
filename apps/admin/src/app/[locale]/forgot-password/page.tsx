import { setRequestLocale } from 'next-intl/server';
import { AdminForgotPassword } from '@/components/admin-forgot-password';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AdminForgotPassword />;
}
