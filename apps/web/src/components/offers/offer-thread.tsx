'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  Alert,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Label,
  Skeleton,
} from '@markaz/ui';
import {
  normalizeAmountInput,
  validateOfferAmount,
  offerComparison,
  EXPIRY_OPTIONS,
  DEFAULT_EXPIRY_OPTION,
  REJECT_REASON_CODES,
  type ExpiryOption,
} from '@markaz/domain';
import { useOfferThreadChannel } from '@markaz/realtime';
import { Link, useRouter } from '@/i18n/navigation';
import { trpc } from '@/trpc/react';
import type { RouterOutputs } from '@/trpc/types';
import { formatAed } from '@/lib/format';
import { AmountComparison, NonBindingDisclosure, OfferStatusBadge, RealtimeBanner, useOfferErrorMessage } from './shared';
import { OfferTimeline } from './offer-timeline';

/** Shared, perspective-aware offer thread (offers-design-spec §19–24). */
export function OfferThread({ threadId }: { threadId: string }) {
  const t = useTranslations('offers');
  const utils = trpc.useUtils();
  const errMsg = useOfferErrorMessage();
  const [announce, setAnnounce] = useState('');

  const q = trpc.offers.getThread.useQuery({ threadId }, { retry: false });
  const { status: rtStatus } = useOfferThreadChannel(threadId, () => {
    void utils.offers.getThread.invalidate({ threadId });
    void utils.offers.getUnreadCounts.invalidate();
  });

  if (q.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <Skeleton className="h-72" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  if (q.isError || !q.data) {
    return (
      <div className="mx-auto max-w-[680px]">
        <EmptyState
          title={t('error.notAvailableTitle')}
          description={t('error.notAvailableBody')}
          action={<Button asChild variant="outline"><Link href="/offers">{t('closed.returnOffers')}</Link></Button>}
        />
      </div>
    );
  }

  const { thread, timeline } = q.data;
  const perspective = thread.perspective;
  const buyerLabel = thread.perspective === 'SELLER' ? thread.buyerLabel : null;
  const title =
    perspective === 'BUYER'
      ? t('thread.buyerTitle', { headline: thread.property.headline })
      : t('thread.sellerTitle', { buyer: t('buyerLabel', { n: buyerLabel ?? '01' }) });

  return (
    <div className="space-y-6">
      <span role="status" aria-live="polite" className="sr-only">{announce}</span>
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link href="/offers" className="hover:text-foreground">{t('title')}</Link>
      </nav>

      <header className="space-y-1">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold" dir="auto">{title}</h1>
          <OfferStatusBadge statusKey={thread.statusKey} />
        </div>
        <p className="text-muted-foreground">{[thread.property.community, thread.property.emirate].filter(Boolean).join(' · ')}</p>
      </header>

      <RealtimeBanner status={rtStatus} onRefresh={() => void utils.offers.getThread.invalidate({ threadId })} />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <CurrentProposal thread={thread} />
          <section aria-labelledby="timeline-h">
            <h2 id="timeline-h" className="text-lg font-semibold">{t('thread.history')}</h2>
            <OfferTimeline events={timeline} perspective={perspective} buyerLabel={buyerLabel} />
          </section>
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <DecisionPanel
            thread={thread}
            threadId={threadId}
            onDone={(key) => {
              setAnnounce(key ? t(`announce.${key}` as 'announce.accepted') : '');
              void utils.offers.getThread.invalidate({ threadId });
              void utils.offers.getBuyerThreads.invalidate();
              void utils.offers.getSellerInbox.invalidate();
              void utils.offers.getUnreadCounts.invalidate();
            }}
            onError={(e) => setAnnounce(errMsg(e))}
          />
        </aside>
      </div>
    </div>
  );
}

type ThreadData = RouterOutputs['offers']['getThread']['thread'];

function CurrentProposal({ thread }: { thread: ThreadData }) {
  const t = useTranslations('offers');
  const locale = useLocale();
  const cp = thread.currentProposal;
  if (!cp) return null;
  const byLabel = cp.byYou ? t('thread.proposedByYou') : cp.bySide === 'BUYER' ? t('thread.proposedByBuyer') : t('thread.proposedBySeller');
  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <p className="text-sm text-muted-foreground">{t('thread.current')}</p>
        <p className="text-3xl font-semibold tabular-nums" dir="ltr">{formatAed(cp.amountAed, locale)}</p>
        <AmountComparison comparison={thread.comparison} />
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <Meta label={t('thread.nextAction')} value={byLabel} />
          <Meta label={t('askingPrice')} value={formatAed(thread.property.askingPriceAed, locale)} />
          {cp.expiresAt ? <Meta label={t('thread.validUntil', { date: new Date(cp.expiresAt).toLocaleString(locale) })} value="" /> : null}
        </dl>
      </CardContent>
    </Card>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      {value ? <dd className="font-medium" dir="ltr">{value}</dd> : null}
    </div>
  );
}

type AnnounceKey = 'accepted' | 'declined' | 'withdrew' | 'counterReceived';

function DecisionPanel({
  thread,
  threadId,
  onDone,
  onError,
}: {
  thread: ThreadData;
  threadId: string;
  onDone: (announce?: AnnounceKey) => void;
  onError: (e: unknown) => void;
}) {
  const t = useTranslations('offers');
  const [dialog, setDialog] = useState<null | 'counter' | 'accept' | 'reject' | 'withdraw'>(null);

  // Closed / terminal states show a calm panel + Week-5 handoff for accepted.
  if (thread.status === 'ACCEPTED') {
    return <AcceptedPanel thread={thread} threadId={threadId} />;
  }
  if (thread.status !== 'AWAITING_BUYER' && thread.status !== 'AWAITING_SELLER') {
    return <ClosedPanel thread={thread} />;
  }

  const canAct = thread.isActionable;
  const canWithdraw = thread.perspective === 'BUYER';

  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        {canAct ? (
          <>
            <Button className="w-full" onClick={() => setDialog('accept')}>{t('actions.accept')}</Button>
            <Button className="w-full" variant="outline" onClick={() => setDialog('counter')}>{t('actions.counter')}</Button>
            <Button className="w-full" variant="ghost" onClick={() => setDialog('reject')}>{t('actions.reject')}</Button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            {thread.perspective === 'BUYER' ? t('status.waitingSeller') : t('status.waitingBuyer')}
          </p>
        )}
        {canWithdraw ? (
          <Button className="w-full" variant="ghost" onClick={() => setDialog('withdraw')}>{t('actions.withdraw')}</Button>
        ) : null}

        {dialog === 'counter' ? (
          <CounterDialog thread={thread} threadId={threadId} onClose={() => setDialog(null)} onDone={() => { setDialog(null); onDone(); }} onError={onError} />
        ) : null}
        {dialog === 'accept' ? (
          <AcceptDialog thread={thread} threadId={threadId} onClose={() => setDialog(null)} onDone={() => { setDialog(null); onDone('accepted'); }} onError={onError} />
        ) : null}
        {dialog === 'reject' ? (
          <RejectDialog thread={thread} threadId={threadId} onClose={() => setDialog(null)} onDone={() => { setDialog(null); onDone('declined'); }} onError={onError} />
        ) : null}
        {dialog === 'withdraw' ? (
          <WithdrawDialog threadId={threadId} version={thread.version} onClose={() => setDialog(null)} onDone={() => { setDialog(null); onDone('withdrew'); }} onError={onError} />
        ) : null}
      </CardContent>
    </Card>
  );
}

function AcceptedPanel({ thread, threadId }: { thread: ThreadData; threadId: string }) {
  const t = useTranslations('offers');
  const tt = useTranslations('transactions');
  const router = useRouter();
  const create = trpc.transactions.createFromAcceptedOffer.useMutation({
    onSuccess: (r) => router.push(`/transactions/${r.transactionId}`),
  });
  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <h2 className="text-lg font-semibold">{t('accept.successTitle')}</h2>
        <p className="text-sm text-muted-foreground">{thread.perspective === 'SELLER' ? t('accept.sellerSuccess') : t('accept.buyerSuccess')}</p>
        <NonBindingDisclosure variant="accept" />
        <div className="flex flex-col gap-2">
          {/* Week-5 handoff: open the shared transaction workspace (idempotent create). */}
          <Button loading={create.isPending} onClick={() => create.mutate({ offerThreadId: threadId })}>
            {tt('continue')}
          </Button>
          <Button asChild variant="outline"><Link href="/offers">{t('closed.returnOffers')}</Link></Button>
          {thread.property.publicId ? (
            <Button asChild variant="ghost"><Link href={`/properties/${thread.property.publicId}/${thread.property.slug ?? ''}`}>{t('closed.viewProperty')}</Link></Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function ClosedPanel({ thread }: { thread: ThreadData }) {
  const t = useTranslations('offers');
  const body: Record<string, string> = {
    REJECTED: t('closed.rejectedBody'),
    WITHDRAWN: t('closed.withdrawnBody'),
    EXPIRED: t('closed.expiredBody'),
    CLOSED_OTHER_ACCEPTED: t('closed.otherAcceptedBody'),
    CLOSED_LISTING_UNAVAILABLE: thread.closedReason === 'LISTING_PAUSED' ? t('closed.pausedBody') : t('closed.changedBody'),
  };
  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <OfferStatusBadge statusKey={thread.statusKey} />
        <p className="text-sm text-muted-foreground">{body[thread.status] ?? t('closed.withdrawnBody')}</p>
        <Button asChild variant="outline" className="w-full"><Link href="/offers">{t('closed.returnOffers')}</Link></Button>
      </CardContent>
    </Card>
  );
}

// --- Action dialogs ----------------------------------------------------------
function CounterDialog({
  thread, threadId, onClose, onDone, onError,
}: { thread: ThreadData; threadId: string; onClose: () => void; onDone: () => void; onError: (e: unknown) => void }) {
  const t = useTranslations('offers');
  const tv = useTranslations('offers.validation');
  const locale = useLocale();
  const [raw, setRaw] = useState('');
  const [expiry, setExpiry] = useState<ExpiryOption>(DEFAULT_EXPIRY_OPTION);
  const amount = useMemo(() => normalizeAmountInput(raw), [raw]);
  const asking = thread.property.askingPriceAed ?? 0;
  const current = thread.currentProposal?.amountAed ?? null;
  const amountError = validateOfferAmount(amount);
  const equal = amount != null && current != null && amount === current;
  const isBuyer = thread.perspective === 'BUYER';
  const counter = (isBuyer ? trpc.offers.submitBuyerCounter : trpc.offers.submitSellerCounter).useMutation();

  async function go() {
    if (amountError || equal) return;
    try {
      await counter.mutateAsync({ threadId, amountAed: amount!, expiry, expectedVersion: thread.version });
      onDone();
    } catch (e) {
      onError(e);
      onClose();
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isBuyer ? t('counter.buyerTitle') : t('counter.sellerTitle')}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{t('counter.description')}</p>
        {current != null ? (
          <p className="text-sm">{t('counter.previous')}: <span dir="ltr" className="font-medium">{formatAed(current, locale)}</span></p>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="counter-amount">{t('form.amount')}</Label>
          <div className="flex items-center gap-2 rounded-md border px-3">
            <span aria-hidden className="text-muted-foreground">AED</span>
            <input id="counter-amount" inputMode="numeric" dir="ltr" value={raw} onChange={(e) => setRaw(e.target.value)} placeholder={t('form.placeholder')} className="h-11 flex-1 bg-transparent tabular-nums outline-none" aria-invalid={!!amountError || equal} aria-describedby="counter-err" />
          </div>
          <AmountComparison comparison={amount != null && asking ? offerComparison(amount, asking) : null} />
          {equal ? <p id="counter-err" role="alert" className="text-sm text-destructive">{t('counter.equalError')}</p> : amountError && raw ? <p id="counter-err" role="alert" className="text-sm text-destructive">{tv('invalid')}</p> : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="counter-expiry">{t('form.expiry')}</Label>
          <select id="counter-expiry" value={expiry} onChange={(e) => setExpiry(e.target.value as ExpiryOption)} className="h-11 w-full rounded-md border bg-background px-3">
            {EXPIRY_OPTIONS.map((o) => <option key={o} value={o}>{t(`expiry.${o === '48h' ? 'h48' : o === '3d' ? 'd3' : o === '7d' ? 'd7' : 'none'}` as 'expiry.d7')}</option>)}
          </select>
        </div>
        <NonBindingDisclosure variant="counter" />
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={counter.isPending}>{t('form.cancel')}</Button>
          <Button onClick={go} loading={counter.isPending} disabled={!!amountError || equal}>{counter.isPending ? t('counter.submitting') : t('counter.submit')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AcceptDialog({
  thread, threadId, onClose, onDone, onError,
}: { thread: ThreadData; threadId: string; onClose: () => void; onDone: () => void; onError: (e: unknown) => void }) {
  const t = useTranslations('offers');
  const locale = useLocale();
  const isBuyer = thread.perspective === 'BUYER';
  const accept = (isBuyer ? trpc.offers.acceptSellerCounter : trpc.offers.acceptBuyerProposal).useMutation();
  const amount = thread.currentProposal?.amountAed ?? 0;

  async function go() {
    if (!thread.currentProposal) return;
    try {
      await accept.mutateAsync({ threadId, proposalId: thread.currentProposal.id, expectedVersion: thread.version });
      onDone();
    } catch (e) {
      onError(e);
      onClose();
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isBuyer ? t('accept.counterTitle') : t('accept.title')}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{isBuyer ? t('accept.counterBody', { amount: formatAed(amount, locale) }) : t('accept.body')}</p>
        <Alert variant="info"><p className="text-sm">{t('accept.week5')}</p></Alert>
        <NonBindingDisclosure variant="accept" />
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={accept.isPending}>{t('accept.cancel')}</Button>
          <Button onClick={go} loading={accept.isPending}>{accept.isPending ? t('accept.accepting') : isBuyer ? t('accept.counterAction') : t('accept.action')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RejectDialog({
  thread, threadId, onClose, onDone, onError,
}: { thread: ThreadData; threadId: string; onClose: () => void; onDone: () => void; onError: (e: unknown) => void }) {
  const t = useTranslations('offers');
  const isBuyer = thread.perspective === 'BUYER';
  const [reason, setReason] = useState<string>('');
  const reject = (isBuyer ? trpc.offers.rejectSellerCounter : trpc.offers.reject).useMutation();

  async function go() {
    try {
      if (isBuyer) await (reject as ReturnType<typeof trpc.offers.rejectSellerCounter.useMutation>).mutateAsync({ threadId, expectedVersion: thread.version });
      else await (reject as ReturnType<typeof trpc.offers.reject.useMutation>).mutateAsync({ threadId, expectedVersion: thread.version, reasonCode: reason || undefined });
      onDone();
    } catch (e) {
      onError(e);
      onClose();
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isBuyer ? t('reject.counterTitle') : t('reject.title')}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{isBuyer ? t('reject.counterBody') : t('reject.body')}</p>
        {!isBuyer ? (
          <div className="space-y-2">
            <Label htmlFor="reject-reason">{t('reject.reasonLabel')}</Label>
            <select id="reject-reason" value={reason} onChange={(e) => setReason(e.target.value)} className="h-11 w-full rounded-md border bg-background px-3">
              <option value="">—</option>
              {REJECT_REASON_CODES.map((c) => <option key={c} value={c}>{t(`reject.reason${c}` as 'reject.reasonOTHER')}</option>)}
            </select>
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={reject.isPending}>{isBuyer ? t('reject.continue') : t('reject.keep')}</Button>
          <Button variant="destructive" onClick={go} loading={reject.isPending}>{reject.isPending ? t('reject.rejecting') : isBuyer ? t('reject.counterAction') : t('reject.action')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WithdrawDialog({
  threadId, version, onClose, onDone, onError,
}: { threadId: string; version: number; onClose: () => void; onDone: () => void; onError: (e: unknown) => void }) {
  const t = useTranslations('offers');
  const withdraw = trpc.offers.withdraw.useMutation();
  async function go() {
    try {
      await withdraw.mutateAsync({ threadId, expectedVersion: version });
      onDone();
    } catch (e) {
      onError(e);
      onClose();
    }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('withdraw.title')}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{t('withdraw.body')}</p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={withdraw.isPending}>{t('withdraw.keep')}</Button>
          <Button variant="destructive" onClick={go} loading={withdraw.isPending}>{withdraw.isPending ? t('withdraw.withdrawing') : t('withdraw.action')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
