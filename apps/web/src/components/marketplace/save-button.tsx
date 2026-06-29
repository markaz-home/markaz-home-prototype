'use client';

import { useState } from 'react';
import { Heart } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  cn,
  toast,
} from '@markaz/ui';
import { Link } from '@/i18n/navigation';
import { trpc } from '@/trpc/react';
import { storeSaveIntent } from '@/lib/save-intent';

interface SaveButtonProps {
  publicId: string;
  isAuthenticated: boolean;
  returnPath: string;
  initialSaved?: boolean;
  variant?: 'icon' | 'full';
  className?: string;
}

/** Save control with anonymous interception (design spec §27, §28). Server is the
 * source of truth; UI is optimistic and reverts on error. */
export function SaveButton({
  publicId,
  isAuthenticated,
  returnPath,
  initialSaved = false,
  variant = 'icon',
  className,
}: SaveButtonProps) {
  const t = useTranslations('save');
  const locale = useLocale();
  const utils = trpc.useUtils();
  const [saved, setSaved] = useState(initialSaved);
  const [announce, setAnnounce] = useState('');
  const [authOpen, setAuthOpen] = useState(false);

  const save = trpc.marketplace.saved.save.useMutation();
  const remove = trpc.marketplace.saved.remove.useMutation();
  const busy = save.isPending || remove.isPending;

  async function toggle() {
    if (!isAuthenticated) {
      storeSaveIntent({ publicId, returnPath, locale });
      setAuthOpen(true);
      return;
    }
    const next = !saved;
    setSaved(next); // optimistic
    try {
      if (next) await save.mutateAsync({ publicId });
      else await remove.mutateAsync({ publicId });
      setAnnounce(next ? t('success') : t('removed'));
      await utils.marketplace.saved.publicIds.invalidate().catch(() => {});
    } catch {
      setSaved(!next); // revert
      setAnnounce(t('error'));
      toast(t('error'));
    }
  }

  const label = busy
    ? saved
      ? t('saving')
      : t('removing')
    : saved
      ? t('saved')
      : t('save');

  return (
    <>
      <Button
        type="button"
        variant={variant === 'icon' ? 'secondary' : saved ? 'outline' : 'default'}
        size={variant === 'icon' ? 'icon' : 'default'}
        onClick={toggle}
        disabled={busy}
        aria-pressed={saved}
        aria-label={variant === 'icon' ? (saved ? t('saved') : t('save')) : undefined}
        className={cn(variant === 'icon' && 'h-11 w-11 rounded-full shadow-sm', className)}
      >
        <Heart className={cn('h-5 w-5', saved && 'fill-current')} aria-hidden />
        {variant === 'full' && <span className="ms-2">{label}</span>}
      </Button>

      <span role="status" aria-live="polite" className="sr-only">
        {announce}
      </span>

      <Dialog open={authOpen} onOpenChange={setAuthOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('authTitle')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t('authBody')}</p>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button asChild className="w-full">
              <Link href="/sign-in">{t('signIn')}</Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href="/sign-up">{t('createAccount')}</Link>
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => setAuthOpen(false)}>
              {t('continueBrowsing')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
