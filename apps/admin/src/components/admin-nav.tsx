'use client';
import { useTranslations } from 'next-intl';
import {
  LayoutDashboard,
  Users,
  Building2,
  FileCheck2,
  Tag,
  Receipt,
  BadgeCheck,
  ScrollText,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@markaz/ui';
import { Link, usePathname } from '@/i18n/navigation';
import { LanguageSwitcher } from './language-switcher';
import { AdminSignOut } from './admin-sign-out';

// Spec §8 — the eight fixed operations areas, in order.
const ITEMS = [
  { href: '/overview', key: 'nav.overview', icon: LayoutDashboard },
  { href: '/customers', key: 'nav.customers', icon: Users },
  { href: '/listings', key: 'nav.listings', icon: Building2 },
  { href: '/publication', key: 'nav.publication', icon: FileCheck2 },
  { href: '/offers', key: 'nav.offers', icon: Tag },
  { href: '/transactions', key: 'nav.transactions', icon: Receipt },
  { href: '/verifications', key: 'nav.verifications', icon: BadgeCheck },
  { href: '/audit', key: 'nav.audit', icon: ScrollText },
] as const;

export function AdminNav({ email }: { email: string | null }) {
  const t = useTranslations('admin');
  const pathname = usePathname();

  return (
    <aside className="bg-brand-900 text-brand-100 flex w-60 shrink-0 flex-col">
      <div className="border-brand-800 flex h-16 items-center gap-2 border-b px-4 font-semibold text-white">
        <ShieldCheck className="text-brand-300 h-5 w-5" aria-hidden />
        {t('appName')}
      </div>
      <nav className="flex-1 space-y-1 p-2" aria-label="Admin">
        {ITEMS.map(({ href, key, icon: Icon }) => {
          // Active when the current path is this area or one of its detail pages.
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-brand-700 text-white'
                  : 'text-brand-300 hover:bg-brand-800 hover:text-white',
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {t(key)}
            </Link>
          );
        })}
      </nav>
      <div className="border-brand-800 text-brand-100 space-y-2 border-t p-3">
        <p className="text-brand-300 truncate px-1 text-xs">{email}</p>
        <div className="flex items-center justify-between">
          <LanguageSwitcher />
          <AdminSignOut />
        </div>
      </div>
    </aside>
  );
}
