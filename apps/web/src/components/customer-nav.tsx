'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Menu, X, UserCircle2, Home } from 'lucide-react';
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
import { LanguageSwitcher } from './language-switcher';
import { SignOutButton } from './sign-out-button';
import { NotificationBell, OffersNavBadge } from './offers/notification-bell';
import { TransactionsNavBadge } from './transactions/shared';

const NAV_ITEMS = [
  { href: '/dashboard', key: 'dashboard' },
  { href: '/properties', key: 'browse' },
  { href: '/saved-properties', key: 'saved' },
  { href: '/sell', key: 'myListings' },
  { href: '/offers', key: 'offers' },
  { href: '/transactions', key: 'transactions' },
] as const;

export function CustomerNav({ displayName }: { displayName: string | null }) {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="container flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
            <Home className="h-5 w-5 text-primary" aria-hidden />
            MARKAZ Home
          </Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
            {NAV_ITEMS.map((item) => {
              const active = item.href === '/properties' ? pathname.startsWith('/properties') : pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    active
                      ? 'bg-secondary text-secondary-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {t(item.key)}
                  {item.key === 'offers' ? <OffersNavBadge /> : null}
                  {item.key === 'transactions' ? <TransactionsNavBadge /> : null}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <NotificationBell />
          <LanguageSwitcher />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" aria-label={t('account')}>
                <UserCircle2 className="h-5 w-5" aria-hidden />
                <span className="hidden max-w-[10rem] truncate sm:inline">
                  {displayName ?? t('account')}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>{displayName ?? t('account')}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/account/profile">{t('profile')}</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/account/notifications">{t('notifications')}</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/account/help">{t('help')}</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <SignOutButton asMenuItem />
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label={open ? t('closeMenu') : t('openMenu')}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {open ? (
        <nav className="border-t bg-background md:hidden" aria-label="Mobile">
          <div className="container flex flex-col py-2">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                {t(item.key)}
              </Link>
            ))}
          </div>
        </nav>
      ) : null}
    </header>
  );
}
