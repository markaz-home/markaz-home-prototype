'use client';

import { useState } from 'react';
import { Menu, UserCircle2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
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
import { BrandLogo } from '@/components/brand-logo';
import { LanguageSwitcher } from '@/components/language-switcher';

const PUBLIC_LINKS = [
  { href: '/properties', key: 'browse' },
  { href: '/', key: 'howItWorks' },
  { href: '/sign-in?next=/sell', key: 'forSellers' },
] as const;

const AUTHED_LINKS = [
  { href: '/dashboard', key: 'dashboard' },
  { href: '/properties', key: 'browse' },
  { href: '/saved-properties', key: 'saved' },
  { href: '/sell', key: 'myListings' },
] as const;

/** Adaptive marketplace chrome (design spec §11). Public nav for anonymous
 * visitors; the authenticated customer nav once signed in. */
export function MarketplaceHeader({
  isAuthenticated,
  displayName,
}: {
  isAuthenticated: boolean;
  displayName: string | null;
}) {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const links = isAuthenticated ? AUTHED_LINKS : PUBLIC_LINKS;

  const isActive = (href: string) =>
    href === '/properties' ? pathname.startsWith('/properties') : pathname === href;

  return (
    <header className="bg-background/95 sticky top-0 z-40 border-b backdrop-blur">
      <div className="container flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <Link href={isAuthenticated ? '/dashboard' : '/'} aria-label={t('home')}>
            <BrandLogo />
          </Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
            {links.map((item) => (
              <Link
                key={item.href + item.key}
                href={item.href}
                className={cn(
                  'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive(item.href)
                    ? 'bg-secondary text-secondary-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t(item.key)}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          {isAuthenticated ? (
            <>
              <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
                <Link href="/sell">{t('listProperty')}</Link>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <UserCircle2 className="h-5 w-5" aria-hidden />
                    <span className="ms-1 hidden sm:inline">{displayName}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>{displayName ?? t('account')}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard">{t('dashboard')}</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/saved-properties">{t('saved')}</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/sell">{t('myListings')}</Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link href="/sign-in">{t('signIn')}</Link>
              </Button>
              <Button asChild size="sm" className="hidden sm:inline-flex">
                <Link href="/sign-in?next=/sell">{t('listProperty')}</Link>
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label={open ? t('closeMenu') : t('openMenu')}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {open && (
        <nav className="bg-background border-t md:hidden" aria-label="Primary mobile">
          <div className="container flex flex-col py-2">
            {links.map((item) => (
              <Link
                key={item.href + item.key}
                href={item.href}
                className="text-foreground rounded-md px-3 py-2 text-sm font-medium"
                onClick={() => setOpen(false)}
              >
                {t(item.key)}
              </Link>
            ))}
            {!isAuthenticated && (
              <Link
                href="/sign-in"
                className="text-foreground rounded-md px-3 py-2 text-sm font-medium"
                onClick={() => setOpen(false)}
              >
                {t('signIn')}
              </Link>
            )}
            <Link
              href={isAuthenticated ? '/sell' : '/sign-in?next=/sell'}
              className="text-foreground rounded-md px-3 py-2 text-sm font-medium"
              onClick={() => setOpen(false)}
            >
              {t('listProperty')}
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
