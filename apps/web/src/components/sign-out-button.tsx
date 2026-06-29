'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { LogOut } from 'lucide-react';
import { createSupabaseBrowserClient } from '@markaz/auth/browser';
import { useRouter } from '@/i18n/navigation';
import { trpc } from '@/trpc/react';

export function SignOutButton({ asMenuItem = false }: { asMenuItem?: boolean }) {
  const t = useTranslations('nav');
  const router = useRouter();
  const audit = trpc.audit.record.useMutation();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    // Best-effort audit while the session is still valid, then end it.
    await audit.mutateAsync({ action: 'CUSTOMER_SIGNED_OUT' }).catch(() => {});
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
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
          : 'inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50'
      }
    >
      <LogOut className="h-4 w-4" aria-hidden />
      {t('signOut')}
    </button>
  );
}
