import { setRequestLocale } from 'next-intl/server';
import { requireAdmin } from '@/server/session';
import { AdminNav } from '@/components/admin-nav';

export default async function PortalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await requireAdmin(locale);
  return (
    <div className="flex min-h-dvh">
      <AdminNav email={session.email} />
      <main className="flex-1 overflow-auto p-8">{children}</main>
    </div>
  );
}
