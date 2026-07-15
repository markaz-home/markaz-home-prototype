'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@markaz/ui';
import { CANCELLATION_REASONS } from '@markaz/domain';
import { Link } from '@/i18n/navigation';
import { trpc } from '@/trpc/react';
import type { RouterOutputs } from '@/trpc/types';

type Detail = RouterOutputs['transactions']['get'];

export function TerminalPanel({ d }: { d: Detail }) {
  const t = useTranslations('transactions');
  if (d.status === 'COMPLETED_DEMO') {
    return (
      <Card>
        <CardContent className="space-y-2 pt-6">
          <h2 className="text-lg font-semibold">{t('completion.successTitle')}</h2>
          <p className="text-muted-foreground text-sm">{t('completion.successBody')}</p>
        </CardContent>
      </Card>
    );
  }
  if (d.status === 'CANCELLED') {
    return (
      <Card>
        <CardContent className="space-y-3 pt-6">
          <h2 className="text-lg font-semibold">{t('cancellation.cancelledTitle')}</h2>
          <p className="text-muted-foreground text-sm">{t('cancellation.cancelledBody')}</p>
          {d.perspective === 'SELLER' && d.property?.publicId ? (
            <Button asChild variant="outline">
              <Link href={`/sell/listings`}>{t('cancellation.reviewListing')}</Link>
            </Button>
          ) : null}
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardContent className="pt-6">
        <h2 className="text-lg font-semibold">{t('status.failed')}</h2>
      </CardContent>
    </Card>
  );
}

export function CancellationPending({ d, refresh }: { d: Detail; refresh: () => void }) {
  const t = useTranslations('transactions');
  const resolve = trpc.transactions.resolveCancellation.useMutation({ onSuccess: refresh });
  const iRequested = d.cancellation?.requestedBySide === d.perspective;
  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <h2 className="font-semibold">{t('cancellation.pendingTitle')}</h2>
        <p className="text-muted-foreground text-sm">{t('cancellation.pendingBody')}</p>
        {!iRequested ? (
          <div className="flex gap-2">
            <Button
              loading={resolve.isPending}
              onClick={() =>
                resolve.mutate({ transactionId: d.id, expectedVersion: d.version, confirm: true })
              }
            >
              {t('cancellation.confirm')}
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                resolve.mutate({ transactionId: d.id, expectedVersion: d.version, confirm: false })
              }
            >
              {t('cancellation.decline')}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function CancellationControl({ d, refresh }: { d: Detail; refresh: () => void }) {
  const t = useTranslations('transactions');
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof CANCELLATION_REASONS)[number]>('BUYER_UNABLE');
  const request = trpc.transactions.requestCancellation.useMutation({
    onSuccess: () => {
      setOpen(false);
      refresh();
    },
  });
  if (d.status === 'CANCELLATION_PENDING') return null;
  return (
    <>
      <Button variant="ghost" className="text-destructive w-full" onClick={() => setOpen(true)}>
        {t('cancellation.request')}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('cancellation.requestTitle')}</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">{t('cancellation.requestBody')}</p>
          <label className="text-sm">
            {t('cancellation.reasonLabel')}
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as typeof reason)}
              className="mt-1 h-11 w-full rounded-md border px-3"
            >
              {CANCELLATION_REASONS.map((r) => (
                <option key={r} value={r}>
                  {t(`cancellation.reason.${r}` as 'cancellation.reason.OTHER')}
                </option>
              ))}
            </select>
          </label>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t('cancellation.keep')}
            </Button>
            <Button
              loading={request.isPending}
              onClick={() =>
                request.mutate({ transactionId: d.id, expectedVersion: d.version, reason })
              }
            >
              {t('cancellation.request')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
