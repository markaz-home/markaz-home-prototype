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
  Menu,
} from 'lucide-react';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  cn,
} from '@markaz/ui';
import { Link, usePathname } from '@/i18n/navigation';
import { AdminSignOut } from './admin-sign-out';
import { BrandLogo } from './brand-logo';

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
    <aside className="border-border/70 bg-card/40 text-foreground hidden w-60 shrink-0 flex-col border-e lg:flex">
      <div className="border-border/70 flex h-16 items-center gap-2.5 border-b px-4">
        <BrandLogo className="h-6 w-auto" />
        <span className="text-muted-foreground text-[10px] font-semibold uppercase tracking-[0.16em]">
          {t('operationsLabel')}
        </span>
      </div>
      <nav className="flex-1 space-y-1 p-2" aria-label={t('navigationLabel')}>
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
                  ? 'bg-primary/10 text-foreground'
                  : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {t(key)}
            </Link>
          );
        })}
      </nav>
      <div className="border-border/70 mt-auto border-t p-3">
        <div className="border-border/70 bg-foreground/[0.02] flex items-center gap-2.5 rounded-lg border px-3 py-2.5">
          <span className="min-w-0 flex-1">
            <span className="text-muted-foreground block text-[10px] uppercase tracking-wide">
              {t('signedInAs')}
            </span>
            <span className="block truncate text-[13px] font-medium">{email}</span>
          </span>
          <AdminSignOut variant="icon" />
        </div>
      </div>
    </aside>
  );
}

/** Compact operations navigation for tablet/mobile layouts. */
export function AdminMobileNav({ email }: { email: string | null }) {
  const t = useTranslations('admin');
  const navT = useTranslations('nav');
  const pathname = usePathname();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="shrink-0 lg:hidden"
          aria-label={navT('openMenu')}
        >
          <Menu className="h-4 w-4" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 lg:hidden">
        <DropdownMenuLabel className="flex items-center gap-2.5">
          <BrandLogo className="h-5 w-auto" />
          <span className="text-muted-foreground text-[10px] uppercase tracking-[0.14em]">
            {t('operationsLabel')}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {ITEMS.map(({ href, key, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <DropdownMenuItem key={href} asChild>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(active && 'bg-accent font-semibold')}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {t(key)}
              </Link>
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <div className="flex items-center gap-2 px-2 py-1.5">
          <span className="min-w-0 flex-1 truncate text-xs" dir="ltr">
            {email}
          </span>
          <AdminSignOut variant="icon" />
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
