'use client';
import { useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { LogOut } from 'lucide-react';
import { Button } from '@markaz/ui';
import { createSupabaseBrowserClient } from '@markaz/auth/browser';
import { useRouter } from '@/i18n/navigation';

export function AdminSignOut({ variant = 'ghost' }: { variant?: 'ghost' | 'outline' | 'icon' }) {
  const t = useTranslations('common');
  const router = useRouter();
  const errorId = useId();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const signOut = async () => {
    setBusy(true);
    setFailed(false);
    const { error } = await createSupabaseBrowserClient().auth.signOut();
    if (error) {
      setFailed(true);
      setBusy(false);
      return;
    }
    router.replace('/signed-out');
  };

  if (variant === 'icon') {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        loading={busy}
        aria-label={t('signOut')}
        title={t('signOut')}
        aria-describedby={failed ? errorId : undefined}
        onClick={signOut}
      >
        <LogOut className="h-4 w-4" aria-hidden />
        {failed ? (
          <span id={errorId} role="alert" className="sr-only">
            {t('signOutError')}
          </span>
        ) : null}
      </Button>
    );
  }

  return (
    <span>
      <Button
        variant={variant}
        size="sm"
        loading={busy}
        aria-describedby={failed ? errorId : undefined}
        onClick={signOut}
      >
        <LogOut className="h-4 w-4" aria-hidden />
        {t('signOut')}
      </Button>
      {failed ? (
        <span id={errorId} role="alert" className="sr-only">
          {t('signOutError')}
        </span>
      ) : null}
    </span>
  );
}
