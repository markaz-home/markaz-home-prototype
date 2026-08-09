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
import { ListboxSelect } from '@/components/ui/listbox-select';
import { CompletionSummary } from './completion-summary';

/** Dialog-sized trigger: matches the 44px inputs used inside these dialogs. */
const TALL_TRIGGER =
  'border-input bg-background hover:border-primary/50 flex h-11 w-full items-center justify-between gap-2 rounded-md border px-3 text-start text-sm outline-none focus-visible:ring-ring focus-visible:ring-2';

type Detail = RouterOutputs['transactions']['get'];

export function TerminalPanel({ d }: { d: Detail }) {
  const t = useTranslations('transactions');
  // Completion is the end of the journey — it gets a record, not a sentence.
  if (d.status === 'COMPLETED_DEMO') return <CompletionSummary d={d} />;
  if (d.status === 'CANCELLED') {
    const reason = d.cancellation?.reason
      ? t(`cancellation.reason.${d.cancellation.reason}` as 'cancellation.reason.OTHER')
      : null;
    return (
      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="space-y-4 pt-6">
          <h2 className="text-lg font-semibold">{t('cancellation.cancelledTitle')}</h2>
          <p className="text-muted-foreground text-sm leading-6">
            {t(
              d.perspective === 'SELLER'
                ? 'cancellation.sellerCancelledBody'
                : 'cancellation.buyerCancelledBody',
            )}
          </p>
          {reason ? (
            <p className="border-border/70 bg-background/50 rounded-md border px-3 py-2 text-sm">
              {t('cancellation.reasonSummary', { reason })}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {d.perspective === 'SELLER' ? (
              <Button asChild variant="outline">
                <Link href="/sell">{t('cancellation.reviewListing')}</Link>
              </Button>
            ) : (
              <Button asChild variant="outline">
                <Link href="/properties">{t('cancellation.browseProperties')}</Link>
              </Button>
            )}
            <Button asChild variant="outline">
              <Link href="/transactions">{t('cancellation.backTransactions')}</Link>
            </Button>
          </div>
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
  const requester =
    d.cancellation?.requestedBySide === 'BUYER'
      ? t('participants.buyer')
      : d.cancellation?.requestedBySide === 'SELLER'
        ? t('participants.seller')
        : t('participants.otherParticipant');
  const reason = d.cancellation?.reason
    ? t(`cancellation.reason.${d.cancellation.reason}` as 'cancellation.reason.OTHER')
    : null;
  return (
    <Card className="border-primary/35 bg-primary/5">
      <CardContent className="space-y-4 pt-6">
        <h2 className="font-semibold">{t('cancellation.pendingTitle')}</h2>
        <p className="text-muted-foreground text-sm leading-6">
          {iRequested
            ? t('cancellation.pendingRequesterBody')
            : t('cancellation.pendingResponderBody', { requester })}
        </p>
        {reason ? (
          <p className="border-border/70 bg-background/50 rounded-md border px-3 py-2 text-sm">
            {t('cancellation.reasonSummary', { reason })}
          </p>
        ) : null}
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
        {iRequested ? (
          <p className="text-primary text-xs font-medium">
            {t('cancellation.waitingForResponse')}
          </p>
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
          <div className="text-sm">
            <span id="cancel-reason-label">{t('cancellation.reasonLabel')}</span>
            <div className="mt-1">
              <ListboxSelect
                labelledBy="cancel-reason-label"
                value={reason}
                onChange={(v) => setReason(v as typeof reason)}
                classNames={{ button: TALL_TRIGGER }}
                options={CANCELLATION_REASONS.map((r) => ({
                  value: r,
                  label: t(`cancellation.reason.${r}` as 'cancellation.reason.OTHER'),
                }))}
              />
            </div>
          </div>
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
