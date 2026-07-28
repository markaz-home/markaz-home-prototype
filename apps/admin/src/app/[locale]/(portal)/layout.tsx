import { setRequestLocale } from 'next-intl/server';
import { requireAdmin } from '@/server/session';
import { AdminMobileNav, AdminNav } from '@/components/admin-nav';
import { GlobalSearch } from '@/components/admin/search';
import { LanguageSwitcher } from '@/components/language-switcher';

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
    <div className="flex min-h-dvh min-w-0">
      <a
        href="#main"
        className="focus:bg-background sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded focus:px-3 focus:py-2 focus:shadow"
      >
        Skip to content
      </a>
      <AdminNav email={session.email} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-background flex min-h-16 shrink-0 items-center gap-3 border-b px-3 py-3 sm:gap-4 sm:px-6">
          <AdminMobileNav email={session.email} />
          <GlobalSearch />
          <div className="ms-auto">
            <LanguageSwitcher />
          </div>
        </header>
        <main id="main" className="min-w-0 flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
