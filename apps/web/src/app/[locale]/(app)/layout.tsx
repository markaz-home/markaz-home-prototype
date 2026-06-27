import { setRequestLocale } from 'next-intl/server';
import { requireCustomerStep } from '@/server/session';
import { CustomerNav } from '@/components/customer-nav';

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  // One guard for every authenticated page: must be a fully-onboarded customer.
  const session = await requireCustomerStep(locale, ['dashboard']);

  return (
    <div className="flex min-h-dvh flex-col">
      <CustomerNav displayName={session.profile?.fullName ?? null} />
      <main className="container flex-1 py-8">{children}</main>
    </div>
  );
}
