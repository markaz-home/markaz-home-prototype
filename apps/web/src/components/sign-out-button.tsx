'use client';
import { useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { LogOut } from 'lucide-react';
import { createSupabaseBrowserClient } from '@markaz/auth/browser';
import { useRouter } from '@/i18n/navigation';

export function SignOutButton({ asMenuItem = false }: { asMenuItem?: boolean }) {
  const t = useTranslations('nav');
  const router = useRouter();
  const errorId = useId();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function signOut() {
    setBusy(true);
    setFailed(false);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      setFailed(true);
      setBusy(false);
      return;
    }
    router.replace('/signed-out');
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={busy}
      className={
        asMenuItem
          ? 'flex w-full items-center gap-2 disabled:opacity-50'
          : 'text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm disabled:opacity-50'
      }
      aria-describedby={failed ? errorId : undefined}
    >
      <LogOut className="h-4 w-4" aria-hidden />
      {t('signOut')}
      {failed ? (
        <span id={errorId} role="alert" className="sr-only">
          {t('signOutError')}
        </span>
      ) : null}
    </button>
  );
}
