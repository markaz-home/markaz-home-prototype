'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  ArrowLeftRight,
  Bell,
  Building2,
  CircleHelp,
  Heart,
  Landmark,
  LayoutDashboard,
  Menu,
  Receipt,
  Search,
  UserRound,
  X,
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
import { BrandLogo } from './brand-logo';
import { LanguageSwitcher } from './language-switcher';
import { SignOutButton } from './sign-out-button';
import { NotificationBell, OffersNavBadge } from './offers/notification-bell';
import { TransactionsNavBadge } from './transactions/shared';

const NAV_ITEMS = [
  { href: '/dashboard', key: 'dashboard', icon: LayoutDashboard },
  { href: '/properties', key: 'browse', icon: Search },
  { href: '/saved-properties', key: 'saved', icon: Heart },
  { href: '/sell', key: 'myListings', icon: Building2 },
  { href: '/offers', key: 'offers', icon: ArrowLeftRight },
  { href: '/transactions', key: 'transactions', icon: Receipt },
  { href: '/portfolio', key: 'portfolio', icon: Landmark },
] as const;

function isActive(pathname: string, href: string) {
  return href === '/dashboard' ? pathname === href : pathname.startsWith(href);
}

/**
 * Customer workspace chrome: a persistent sidebar on desktop, a collapsible
 * drawer on mobile. The nav is a vertical rail (not the former header strip) so
 * the six workspace areas stay visible without competing with page headings.
 */
export function WorkspaceShell({
  displayName,
  padded = true,
  children,
}: {
  displayName: string | null;
  /** Off for pages that carry their own `container` (the marketplace views). */
  padded?: boolean;
  children: React.ReactNode;
}) {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const nav = (onNavigate?: () => void) => (
    <nav className="flex flex-col gap-0.5 px-3" aria-label={t('primary')}>
      {NAV_ITEMS.map(({ href, key, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
              active
                ? 'bg-primary/10 text-foreground font-medium'
                : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground',
            )}
          >
            <Icon
              className={cn('h-4 w-4 shrink-0', active ? 'text-primary' : 'text-current')}
              aria-hidden
            />
            <span className="flex-1">{t(key)}</span>
            {key === 'offers' ? <OffersNavBadge /> : null}
            {key === 'transactions' ? <TransactionsNavBadge /> : null}
          </Link>
        );
      })}
    </nav>
  );

  const accountMenu = (placement: 'desktop' | 'mobile') => {
    const desktop = placement === 'desktop';

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="border-border/70 bg-foreground/[0.02] hover:border-border hover:bg-foreground/[0.04] focus-visible:ring-primary/40 flex w-full items-center gap-2.5 rounded-lg border px-3 py-2.5 text-start outline-none transition-colors focus-visible:ring-2"
          >
            <Avatar name={displayName} />
            <span className="min-w-0 flex-1">
              <span className="text-muted-foreground block text-[10px] uppercase tracking-wide">
                {t('signedIn')}
              </span>
              <span className="block truncate text-[13px] font-medium">
                {displayName ?? t('account')}
              </span>
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side={desktop ? 'right' : 'bottom'}
          align={desktop ? 'end' : 'start'}
          sideOffset={12}
          collisionPadding={16}
          className="border-border/80 bg-popover/95 w-56 rounded-xl p-2 shadow-xl backdrop-blur"
        >
          <DropdownMenuLabel className="space-y-0.5 px-2.5 pb-2 pt-1.5">
            <span className="text-muted-foreground block text-[10px] font-medium uppercase tracking-[0.14em]">
              {t('account')}
            </span>
            <span className="block truncate text-sm font-semibold">
              {displayName ?? t('account')}
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="-mx-2 my-1" />
          <DropdownMenuItem asChild className="rounded-lg px-2.5 py-2.5">
            <Link href="/account/profile" className="flex w-full items-center gap-2">
              <UserRound className="text-muted-foreground h-4 w-4" aria-hidden />
              <span>{t('profile')}</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="rounded-lg px-2.5 py-2.5">
            <Link href="/account/notifications" className="flex w-full items-center gap-2">
              <Bell className="text-muted-foreground h-4 w-4" aria-hidden />
              {t('notifications')}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="rounded-lg px-2.5 py-2.5">
            <Link href="/account/help" className="flex w-full items-center gap-2">
              <CircleHelp className="text-muted-foreground h-4 w-4" aria-hidden />
              {t('help')}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator className="-mx-2 my-1" />
          <DropdownMenuItem asChild className="rounded-lg px-2.5 py-2.5">
            <SignOutButton asMenuItem />
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  return (
    <div className="flex min-h-dvh">
      <aside className="border-border/70 bg-card/40 hidden w-[15rem] shrink-0 flex-col border-e pb-4 md:flex">
        <Link href="/dashboard" className="px-5 pt-6">
          <BrandLogo className="h-11 w-auto md:h-11" />
        </Link>
        <p className="text-muted-foreground mt-7 px-6 text-[10px] font-semibold uppercase tracking-[0.16em]">
          {t('workspace')}
        </p>
        <div className="mt-3">{nav()}</div>
        <div className="mx-3 mt-auto pt-6">{accountMenu('desktop')}</div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-background sticky top-0 z-30 flex h-14 items-center justify-between gap-3 px-4 md:px-8">
          <div className="flex items-center gap-2 md:hidden">
            <Button
              variant="ghost"
              size="icon"
              aria-label={open ? t('closeMenu') : t('openMenu')}
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <Link href="/dashboard">
              <BrandLogo className="h-8 w-auto md:h-8" />
            </Link>
          </div>
          <div className="ms-auto flex items-center gap-1">
            <LanguageSwitcher />
            <NotificationBell />
            <Button
              variant="ghost"
              size="icon"
              asChild
              className="border-primary/55 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary rounded-full border"
            >
              <Link href="/account/profile" aria-label={t('profile')} title={t('profile')}>
                <UserRound className="h-4 w-4" aria-hidden />
              </Link>
            </Button>
          </div>
        </header>

        {open ? (
          <div className="border-border/70 bg-card border-b py-3 md:hidden">
            {nav(() => setOpen(false))}
            <div className="mx-3 mt-3">{accountMenu('mobile')}</div>
          </div>
        ) : null}

        <main id="main" className={cn('flex-1', padded && 'px-4 py-6 md:px-8 md:py-8')}>
          {children}
        </main>
      </div>
    </div>
  );
}

function Avatar({ name }: { name: string | null }) {
  const initial = name?.trim().slice(0, 1).toUpperCase() ?? '·';
  return (
    <span
      aria-hidden
      className="border-primary/40 bg-primary/10 text-primary grid h-9 w-9 shrink-0 place-items-center rounded-full border text-sm font-semibold"
    >
      {initial}
    </span>
  );
}
