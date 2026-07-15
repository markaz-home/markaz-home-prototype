import { setRequestLocale } from 'next-intl/server';
import { requireAdmin } from '@/server/session';
import { AdminNav } from '@/components/admin-nav';
import { GlobalSearch } from '@/components/admin/search';

// Every operations surface reads live, per-request data behind an authenticated
// admin session — never serve a prerendered snapshot.
export const dynamic = 'force-dynamic';

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
      <a
        href="#main"
        className="focus:bg-background sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded focus:px-3 focus:py-2 focus:shadow"
      >
        Skip to content
      </a>
      <AdminNav email={session.email} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-background flex h-16 shrink-0 items-center gap-4 border-b px-6">
          <GlobalSearch />
        </header>
        <main id="main" className="flex-1 overflow-auto p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
