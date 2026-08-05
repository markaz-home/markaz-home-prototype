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
import { SignOutButton } from '@/components/sign-out-button';

/**
 * `match` is the path prefix that marks a link as the current section. Links
 * without one never show as active — the home page is not a destination that
 * one of these items "is".
 */
const PUBLIC_LINKS = [
  { href: '/properties', key: 'browse', match: '/properties' },
  { href: '/how-it-works', key: 'howItWorks', match: '/how-it-works' },
] as const;

const AUTHED_LINKS = [
  { href: '/dashboard', key: 'dashboard', match: '/dashboard' },
  { href: '/properties', key: 'browse', match: '/properties' },
  { href: '/saved-properties', key: 'saved', match: '/saved-properties' },
  { href: '/sell', key: 'myListings', match: '/sell' },
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

  const isActive = (item: { href: string; match?: string }) =>
    item.match ? pathname === item.match || pathname.startsWith(`${item.match}/`) : false;

  return (
    <header className="bg-background/85 sticky top-0 z-40 border-b backdrop-blur-xl">
      <div className="container flex h-16 items-center gap-4">
        <div className="flex flex-1 items-center justify-start">
          <Link href={isAuthenticated ? '/dashboard' : '/'} aria-label={t('home')}>
            <BrandLogo />
          </Link>
        </div>

        {/* Centred primary nav — brand gold, per the platform direction. */}
        <nav className="hidden items-center justify-center gap-1 md:flex" aria-label={t('primary')}>
          {links.map((item) => (
            <Link
              key={item.href + item.key}
              href={item.href}
              className={cn(
                'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive(item)
                  ? 'bg-primary/10 text-primary'
                  : 'text-primary/85 hover:bg-primary/10 hover:text-primary',
              )}
            >
              {t(item.key)}
            </Link>
          ))}
        </nav>

        <div className="flex flex-1 items-center justify-end gap-2">
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
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <SignOutButton asMenuItem />
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
                <Link href="/sign-in">{t('logIn')}</Link>
              </Button>
              <Button asChild size="sm" className="hidden sm:inline-flex">
                <Link href="/sign-up">{t('signUp')}</Link>
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
        <nav className="bg-card border-t md:hidden" aria-label={t('primaryMobile')}>
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
            {isAuthenticated ? (
              <>
                <Link
                  href="/sell"
                  className="text-foreground rounded-md px-3 py-2 text-sm font-medium"
                  onClick={() => setOpen(false)}
                >
                  {t('listProperty')}
                </Link>
                <div className="px-3 py-2">
                  <SignOutButton />
                </div>
              </>
            ) : (
              <>
                <Link
                  href="/sign-in"
                  className="text-foreground rounded-md px-3 py-2 text-sm font-medium"
                  onClick={() => setOpen(false)}
                >
                  {t('logIn')}
                </Link>
                <Link
                  href="/sign-up"
                  className="text-primary rounded-md px-3 py-2 text-sm font-semibold"
                  onClick={() => setOpen(false)}
                >
                  {t('signUp')}
                </Link>
              </>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
