'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Ban, CheckCircle2, PauseCircle, PlayCircle, CornerUpLeft, RotateCcw, XOctagon, Gavel,
} from 'lucide-react';
import { toast } from '@markaz/ui';
import {
  RESTRICT_REASONS, RESTORE_REASONS, LISTING_PAUSE_REASONS, RETURN_FOR_CHANGES_REASONS,
  OFFER_CLOSE_REASONS, TRANSACTION_FAIL_REASONS, CANCELLATION_RESOLUTIONS,
} from '@markaz/domain';
import { useRouter } from '@/i18n/navigation';
import { trpc } from '@/trpc/react';
import { ActionDialog } from './action-dialog';
import { ReasonSelect, NoteField } from './reason-select';

/** Shared success handling: toast + re-fetch the server component tree. */
function useDone() {
  const t = useTranslations('admin');
  const router = useRouter();
  return () => {
    toast.success(t('result.success'));
    router.refresh();
  };
}

// ---- Customer ---------------------------------------------------------------
export function RestrictCustomerAction({ customerId }: { customerId: string }) {
  const t = useTranslations('admin');
  const [reason, setReason] = useState('');
  const m = trpc.admin.customers.restrict.useMutation();
  const done = useDone();
  return (
    <ActionDialog
      triggerLabel={t('customer.restrictAction')}
      triggerVariant="outline"
      triggerIcon={<Ban className="h-4 w-4" aria-hidden />}
      title={t('customer.restrict.title')}
      body={t('customer.restrict.body')}
      submitLabel={t('customer.restrict.submit')}
      canSubmit={reason !== ''}
      onSubmit={async () => {
        await m.mutateAsync({ customerId, reason: reason as (typeof RESTRICT_REASONS)[number] });
        done();
      }}
    >
      <ReasonSelect id="restrict-reason" label={t('reasonLabel')} basePath="customer.restrict.reason" values={RESTRICT_REASONS} value={reason} onChange={setReason} />
    </ActionDialog>
  );
}

export function RestoreCustomerAction({ customerId }: { customerId: string }) {
  const t = useTranslations('admin');
  const [reason, setReason] = useState('');
  const m = trpc.admin.customers.restore.useMutation();
  const done = useDone();
  return (
    <ActionDialog
      triggerLabel={t('customer.restoreAction')}
      triggerIcon={<CheckCircle2 className="h-4 w-4" aria-hidden />}
      title={t('customer.restore.title')}
      body={t('customer.restore.body')}
      submitLabel={t('customer.restore.submit')}
      canSubmit={reason !== ''}
      onSubmit={async () => {
        await m.mutateAsync({ customerId, reason: reason as (typeof RESTORE_REASONS)[number] });
        done();
      }}
    >
      <ReasonSelect id="restore-reason" label={t('reasonLabel')} basePath="customer.restore.reason" values={RESTORE_REASONS} value={reason} onChange={setReason} />
    </ActionDialog>
  );
}

// ---- Listing ----------------------------------------------------------------
export function PauseListingAction({ listingId }: { listingId: string }) {
  const t = useTranslations('admin');
  const [reason, setReason] = useState('');
  const m = trpc.admin.listings.pause.useMutation();
  const done = useDone();
  return (
    <ActionDialog
      triggerLabel={t('listing.pauseAction')}
      triggerVariant="outline"
      triggerIcon={<PauseCircle className="h-4 w-4" aria-hidden />}
      title={t('listing.pause.title')}
      body={t('listing.pause.body')}
      submitLabel={t('listing.pause.submit')}
      canSubmit={reason !== ''}
      onSubmit={async () => {
        await m.mutateAsync({ listingId, reason: reason as (typeof LISTING_PAUSE_REASONS)[number] });
        done();
      }}
    >
      <ReasonSelect id="pause-reason" label={t('reasonLabel')} basePath="listing.pause.reason" values={LISTING_PAUSE_REASONS} value={reason} onChange={setReason} />
    </ActionDialog>
  );
}

export function ResumeListingAction({ listingId }: { listingId: string }) {
  const t = useTranslations('admin');
  const [reason, setReason] = useState('');
  const m = trpc.admin.listings.resume.useMutation();
  const done = useDone();
  return (
    <ActionDialog
      triggerLabel={t('listing.resumeAction')}
      triggerIcon={<PlayCircle className="h-4 w-4" aria-hidden />}
      title={t('listing.resume.title')}
      body={t('listing.resume.body')}
      submitLabel={t('listing.resume.submit')}
      canSubmit={reason.trim().length > 0}
      onSubmit={async () => {
        await m.mutateAsync({ listingId, reason: reason.trim() });
        done();
      }}
    >
      <NoteField id="resume-reason" label={t('reasonLabel')} value={reason} onChange={setReason} max={60} placeholder={t('listing.resume.reasonPlaceholder')} />
    </ActionDialog>
  );
}

// ---- Publication ------------------------------------------------------------
export function ApprovePublicationAction({ requestId }: { requestId: string }) {
  const t = useTranslations('admin');
  const [note, setNote] = useState('');
  const m = trpc.admin.publication.approve.useMutation();
  const done = useDone();
  return (
    <ActionDialog
      triggerLabel={t('publication.approveAction')}
      triggerIcon={<CheckCircle2 className="h-4 w-4" aria-hidden />}
      title={t('publication.approve.title')}
      body={t('publication.approve.body')}
      submitLabel={t('publication.approve.submit')}
      onSubmit={async () => {
        await m.mutateAsync({ requestId, note: note.trim() || undefined });
        done();
      }}
    >
      <NoteField id="approve-note" label={t('noteOptional')} value={note} onChange={setNote} />
    </ActionDialog>
  );
}

export function ReturnPublicationAction({ requestId }: { requestId: string }) {
  const t = useTranslations('admin');
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const m = trpc.admin.publication.returnForChanges.useMutation();
  const done = useDone();
  return (
    <ActionDialog
      triggerLabel={t('publication.returnAction')}
      triggerVariant="outline"
      triggerIcon={<CornerUpLeft className="h-4 w-4" aria-hidden />}
      title={t('publication.return.title')}
      body={t('publication.return.body')}
      submitLabel={t('publication.return.submit')}
      canSubmit={reason !== ''}
      onSubmit={async () => {
        await m.mutateAsync({ requestId, reason: reason as (typeof RETURN_FOR_CHANGES_REASONS)[number], note: note.trim() || undefined });
        done();
      }}
    >
      <ReasonSelect id="return-reason" label={t('reasonLabel')} basePath="publication.return.reason" values={RETURN_FOR_CHANGES_REASONS} value={reason} onChange={setReason} />
      <NoteField id="return-note" label={t('noteOptional')} value={note} onChange={setNote} />
    </ActionDialog>
  );
}

// ---- Verification -----------------------------------------------------------
export function RetryVerificationAction({ verificationId }: { verificationId: string }) {
  const t = useTranslations('admin');
  const [reason, setReason] = useState('');
  const m = trpc.admin.verifications.retry.useMutation();
  const done = useDone();
  return (
    <ActionDialog
      triggerLabel={t('verifications.retryAction')}
      triggerIcon={<RotateCcw className="h-4 w-4" aria-hidden />}
      title={t('verifications.retry.title')}
      body={t('verifications.retry.body')}
      submitLabel={t('verifications.retry.submit')}
      canSubmit={reason.trim().length > 0}
      onSubmit={async () => {
        await m.mutateAsync({ verificationId, reason: reason.trim() });
        done();
      }}
    >
      <NoteField id="verify-retry-reason" label={t('reasonLabel')} value={reason} onChange={setReason} max={200} placeholder={t('verifications.retry.reasonPlaceholder')} />
    </ActionDialog>
  );
}

// ---- Offer ------------------------------------------------------------------
export function CloseOfferAction({ threadId }: { threadId: string }) {
  const t = useTranslations('admin');
  const [reason, setReason] = useState('');
  const m = trpc.admin.offers.close.useMutation();
  const done = useDone();
  return (
    <ActionDialog
      triggerLabel={t('adminOffers.closeAction')}
      triggerVariant="outline"
      triggerIcon={<Ban className="h-4 w-4" aria-hidden />}
      title={t('adminOffers.close.title')}
      body={t('adminOffers.close.body')}
      submitLabel={t('adminOffers.close.submit')}
      canSubmit={reason !== ''}
      onSubmit={async () => {
        await m.mutateAsync({ threadId, reason: reason as (typeof OFFER_CLOSE_REASONS)[number] });
        done();
      }}
    >
      <ReasonSelect id="offer-close-reason" label={t('reasonLabel')} basePath="adminOffers.close.reason" values={OFFER_CLOSE_REASONS} value={reason} onChange={setReason} />
    </ActionDialog>
  );
}

// ---- Transaction ------------------------------------------------------------
export function PauseTransactionAction({ transactionId }: { transactionId: string }) {
  const t = useTranslations('admin');
  const [reason, setReason] = useState('');
  const m = trpc.admin.transactions.pause.useMutation();
  const done = useDone();
  return (
    <ActionDialog
      triggerLabel={t('adminTransactions.pauseAction')}
      triggerVariant="outline"
      triggerIcon={<PauseCircle className="h-4 w-4" aria-hidden />}
      title={t('adminTransactions.pause.title')}
      body={t('adminTransactions.pause.body')}
      submitLabel={t('adminTransactions.pause.submit')}
      canSubmit={reason.trim().length > 0}
      onSubmit={async () => {
        await m.mutateAsync({ transactionId, reason: reason.trim() });
        done();
      }}
    >
      <NoteField id="tx-pause-reason" label={t('reasonLabel')} value={reason} onChange={setReason} max={80} placeholder={t('adminTransactions.pause.reasonPlaceholder')} />
    </ActionDialog>
  );
}

export function ResumeTransactionAction({ transactionId }: { transactionId: string }) {
  const t = useTranslations('admin');
  const [reason, setReason] = useState('');
  const m = trpc.admin.transactions.resume.useMutation();
  const done = useDone();
  return (
    <ActionDialog
      triggerLabel={t('adminTransactions.resumeAction')}
      triggerIcon={<PlayCircle className="h-4 w-4" aria-hidden />}
      title={t('adminTransactions.resume.title')}
      body={t('adminTransactions.resume.body')}
      submitLabel={t('adminTransactions.resume.submit')}
      canSubmit={reason.trim().length > 0}
      onSubmit={async () => {
        await m.mutateAsync({ transactionId, reason: reason.trim() });
        done();
      }}
    >
      <NoteField id="tx-resume-reason" label={t('reasonLabel')} value={reason} onChange={setReason} max={80} placeholder={t('adminTransactions.resume.reasonPlaceholder')} />
    </ActionDialog>
  );
}

export function MarkFailedAction({ transactionId }: { transactionId: string }) {
  const t = useTranslations('admin');
  const [reason, setReason] = useState('');
  const m = trpc.admin.transactions.markFailed.useMutation();
  const done = useDone();
  return (
    <ActionDialog
      triggerLabel={t('adminTransactions.markFailedAction')}
      triggerVariant="destructive"
      triggerIcon={<XOctagon className="h-4 w-4" aria-hidden />}
      title={t('adminTransactions.markFailed.title')}
      body={t('adminTransactions.markFailed.body')}
      submitLabel={t('adminTransactions.markFailed.submit')}
      danger
      canSubmit={reason !== ''}
      onSubmit={async () => {
        await m.mutateAsync({ transactionId, reason: reason as (typeof TRANSACTION_FAIL_REASONS)[number] });
        done();
      }}
    >
      <ReasonSelect id="tx-fail-reason" label={t('reasonLabel')} basePath="adminTransactions.markFailed.reason" values={TRANSACTION_FAIL_REASONS} value={reason} onChange={setReason} />
    </ActionDialog>
  );
}

export function RetryStepAction({ transactionId }: { transactionId: string }) {
  const t = useTranslations('admin');
  const [code, setCode] = useState('');
  const [reason, setReason] = useState('');
  const m = trpc.admin.transactions.retryStep.useMutation();
  const done = useDone();
  return (
    <ActionDialog
      triggerLabel={t('adminTransactions.retryAction')}
      triggerVariant="outline"
      triggerIcon={<RotateCcw className="h-4 w-4" aria-hidden />}
      title={t('adminTransactions.retryStep.title')}
      body={t('adminTransactions.retryStep.body')}
      submitLabel={t('adminTransactions.retryStep.submit')}
      canSubmit={code.trim().length > 0 && reason.trim().length > 0}
      onSubmit={async () => {
        await m.mutateAsync({ transactionId, code: code.trim(), reason: reason.trim() });
        done();
      }}
    >
      <NoteField id="tx-retry-code" label={t('adminTransactions.retryStep.codeLabel')} value={code} onChange={setCode} max={60} />
      <NoteField id="tx-retry-reason" label={t('reasonLabel')} value={reason} onChange={setReason} max={200} placeholder={t('adminTransactions.retryStep.reasonPlaceholder')} />
    </ActionDialog>
  );
}

export function ResolveCancellationAction({ transactionId }: { transactionId: string }) {
  const t = useTranslations('admin');
  const [action, setAction] = useState('');
  const [reason, setReason] = useState('');
  const m = trpc.admin.transactions.resolveCancellation.useMutation();
  const done = useDone();
  return (
    <ActionDialog
      triggerLabel={t('adminTransactions.resolveAction')}
      triggerVariant="outline"
      triggerIcon={<Gavel className="h-4 w-4" aria-hidden />}
      title={t('adminTransactions.resolveCancellation.title')}
      body={t('adminTransactions.resolveCancellation.body')}
      submitLabel={t('adminTransactions.resolveCancellation.submit')}
      canSubmit={action !== '' && reason.trim().length > 0}
      onSubmit={async () => {
        await m.mutateAsync({ transactionId, action: action as (typeof CANCELLATION_RESOLUTIONS)[number], reason: reason.trim() });
        done();
      }}
    >
      <ReasonSelect id="tx-resolve-action" label={t('adminTransactions.resolveCancellation.actionLabel')} basePath="adminTransactions.resolveCancellation.action" values={CANCELLATION_RESOLUTIONS} value={action} onChange={setAction} />
      <NoteField id="tx-resolve-reason" label={t('reasonLabel')} value={reason} onChange={setReason} max={200} />
    </ActionDialog>
  );
}
