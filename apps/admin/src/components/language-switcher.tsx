'use client';
import { useLocale, useTranslations } from 'next-intl';
import { Languages } from 'lucide-react';
import { locales, localeLabels, type Locale } from '@markaz/i18n';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  cn,
} from '@markaz/ui';
import { usePathname, useRouter } from '@/i18n/navigation';

export function LanguageSwitcher({ variant = 'default' }: { variant?: 'default' | 'gold' }) {
  const locale = useLocale();
  const t = useTranslations('common');
  const pathname = usePathname();
  const router = useRouter();

  const switchLocale = (nextLocale: Locale) => {
    const query = new URLSearchParams(window.location.search).toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { locale: nextLocale });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={t('language')}
          className={cn(
            variant === 'gold' &&
              'focus-visible:ring-primary text-white/75 hover:bg-white/10 hover:text-white',
          )}
        >
          <Languages className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">{localeLabels[locale as Locale]}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className={cn(
          variant === 'gold' &&
            'theme-platform-gold border-white/10 bg-black/95 text-white shadow-2xl',
        )}
      >
        {locales.map((l) => (
          <DropdownMenuItem
            key={l}
            onClick={() => switchLocale(l)}
            aria-current={l === locale}
            className={l === locale ? 'font-semibold' : undefined}
          >
            {localeLabels[l]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
