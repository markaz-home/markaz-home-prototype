'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button, Card, CardContent } from '@markaz/ui';
import { Link } from '@/i18n/navigation';

const PROMPT_VERSION = 'v1';

export function AccountSetupPrompt({
  userId,
  hasMobile,
  uaePassLinked,
}: {
  userId: string;
  hasMobile: boolean;
  uaePassLinked: boolean;
}) {
  const t = useTranslations('dashboard');
  const [visible, setVisible] = useState(false);
  const storageKey = `markaz.account-setup.${PROMPT_VERSION}.${userId}`;
  const completed = Number(hasMobile) + Number(uaePassLinked);

  useEffect(() => {
    setVisible(window.localStorage.getItem(storageKey) !== 'dismissed');
  }, [storageKey]);

  if (!visible || completed === 2) return null;

  return (
    <Card className="border-primary/25 bg-primary/[0.045] relative overflow-hidden shadow-none">
      <div aria-hidden className="bg-primary/35 absolute inset-y-0 start-0 w-0.5" />
      <CardContent className="p-5 sm:p-6">
        <button
          type="button"
          className="text-muted-foreground hover:bg-foreground/5 hover:text-foreground absolute end-3 top-3 grid h-8 w-8 place-items-center rounded-full transition-colors"
          aria-label={t('accountSetupDismiss')}
          onClick={() => {
            window.localStorage.setItem(storageKey, 'dismissed');
            setVisible(false);
          }}
        >
          <X className="h-4 w-4" aria-hidden />
        </button>

        <div className="grid gap-5 pe-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <p className="text-primary text-[11px] font-semibold uppercase tracking-[0.16em]">
                {t('accountSetupEyebrow')}
              </p>
              <span className="text-muted-foreground text-xs">
                {t('accountSetupProgress', { completed, total: 2 })}
              </span>
            </div>
            <h2 className="font-display mt-2 text-xl">{t('accountSetupTitle')}</h2>
            <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-6">
              {t('accountSetupBody')}
            </p>
          </div>

          <Button asChild className="w-full rounded-full sm:w-auto">
            <Link href="/account/profile">{t('accountSetupAction')}</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
