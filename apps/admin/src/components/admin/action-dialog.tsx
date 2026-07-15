'use client';
import { useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Alert,
} from '@markaz/ui';

/**
 * Shared confirmation-action shell (spec §37: Pause/Return/Mark-Failed/Access
 * dialogs all share this). Owns open + submitting + error state; renders the
 * caller's form body as children; runs `onSubmit` and closes on success. Focus
 * trap + labelled title/description come from the underlying Radix Dialog.
 */
export function ActionDialog({
  triggerLabel,
  triggerVariant = 'default',
  triggerIcon,
  title,
  body,
  submitLabel,
  onSubmit,
  canSubmit = true,
  danger = false,
  children,
}: {
  triggerLabel: string;
  triggerVariant?: 'default' | 'outline' | 'destructive' | 'ghost' | 'secondary';
  triggerIcon?: ReactNode;
  title: string;
  body: string;
  submitLabel: string;
  onSubmit: () => Promise<void>;
  canSubmit?: boolean;
  danger?: boolean;
  children?: ReactNode;
}) {
  const t = useTranslations('admin');
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handle() {
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit();
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : t('error.generic'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!submitting) {
          setOpen(o);
          if (!o) setError(null);
        }
      }}
    >
      <Button variant={triggerVariant} size="sm" onClick={() => setOpen(true)}>
        {triggerIcon}
        {triggerLabel}
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{body}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {children}
          {error ? <Alert variant="destructive">{error}</Alert> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
            {t('cancel')}
          </Button>
          <Button
            variant={danger ? 'destructive' : 'default'}
            onClick={handle}
            disabled={submitting || !canSubmit}
          >
            {submitting ? t('result.pending') : submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
