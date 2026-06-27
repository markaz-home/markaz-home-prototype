'use client';
import { useTranslations } from 'next-intl';
import {
  LayoutDashboard,
  Users,
  Building2,
  FileSearch,
  Tag,
  Receipt,
  Bell,
  SlidersHorizontal,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@markaz/ui';
import { Link, usePathname } from '@/i18n/navigation';
import { LanguageSwitcher } from './language-switcher';
import { AdminSignOut } from './admin-sign-out';

const ITEMS = [
  { href: '/overview', key: 'navOverview', icon: LayoutDashboard },
  { href: '/users', key: 'navUsers', icon: Users },
  { href: '/listings', key: 'navListings', icon: Building2 },
  { href: '/reviews', key: 'navReviews', icon: FileSearch },
  { href: '/offers', key: 'navOffers', icon: Tag },
  { href: '/transactions', key: 'navTransactions', icon: Receipt },
  { href: '/alerts', key: 'navAlerts', icon: Bell },
  { href: '/demo', key: 'navDemoControls', icon: SlidersHorizontal },
] as const;

export function AdminNav({ email }: { email: string | null }) {
  const t = useTranslations('admin');
  const pathname = usePathname();

  return (
    <aside className="flex w-60 shrink-0 flex-col border-e bg-card">
      <div className="flex h-16 items-center gap-2 border-b px-4 font-semibold">
        <ShieldCheck className="h-5 w-5 text-primary" aria-hidden />
        {t('appName')}
      </div>
      <nav className="flex-1 space-y-1 p-2" aria-label="Admin">
        {ITEMS.map(({ href, key, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-secondary text-secondary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {t(key)}
            </Link>
          );
        })}
      </nav>
      <div className="space-y-2 border-t p-3">
        <p className="truncate px-1 text-xs text-muted-foreground">{email}</p>
        <div className="flex items-center justify-between">
          <LanguageSwitcher />
          <AdminSignOut />
        </div>
      </div>
    </aside>
  );
}
