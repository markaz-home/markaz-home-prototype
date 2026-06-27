'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { LogOut } from 'lucide-react';
import { Button } from '@markaz/ui';
import { createSupabaseBrowserClient } from '@markaz/auth/browser';
import { useRouter } from '@/i18n/navigation';

export function AdminSignOut({ variant = 'ghost' }: { variant?: 'ghost' | 'outline' }) {
  const t = useTranslations('common');
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant={variant}
      size="sm"
      loading={busy}
      onClick={async () => {
        setBusy(true);
        await createSupabaseBrowserClient().auth.signOut();
        router.replace('/login');
        router.refresh();
      }}
    >
      <LogOut className="h-4 w-4" aria-hidden />
      {t('signOut')}
    </Button>
  );
}
