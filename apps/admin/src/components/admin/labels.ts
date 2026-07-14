import type { StatusTone } from './status-badge';

/**
 * Raw enum → (tone, i18n key relative to the `admin` namespace). The UI never
 * shows raw enum values (spec §35); every visible state maps to a translated
 * label + a semantic tone. Unknown values fall back to a neutral literal so a new
 * server enum can never crash a page.
 */
type Mapped = { tone: StatusTone; key: string };

export function listingStateLabel(state: string): Mapped {
  const tone: Record<string, StatusTone> = {
    DRAFT: 'neutral', READY_TO_PUBLISH: 'info', LIVE: 'complete', PAUSED: 'paused',
    UNDER_OFFER: 'info', SOLD_DEMO: 'complete', ARCHIVED: 'neutral', REJECTED: 'attention',
  };
  return { tone: tone[state] ?? 'neutral', key: `listings.state.${state}` };
}

export function publicationStatusLabel(status: string): Mapped {
  const tone: Record<string, StatusTone> = {
    PENDING: 'attention', APPROVED_DEMO: 'complete', REJECTED_DEMO: 'info', NOT_SUBMITTED: 'neutral',
  };
  return { tone: tone[status] ?? 'neutral', key: `publication.status.${status}` };
}

export function verificationStatusLabel(status: string): Mapped {
  const tone: Record<string, StatusTone> = {
    PENDING: 'attention', PROCESSING: 'info', VERIFIED_DEMO: 'complete', FAILED_DEMO: 'failed',
  };
  return { tone: tone[status] ?? 'neutral', key: `verifications.status.${status}` };
}

export function offerStatusLabel(status: string): Mapped {
  const tone: Record<string, StatusTone> = {
    DRAFT: 'neutral', AWAITING_SELLER: 'info', AWAITING_BUYER: 'info', ACCEPTED: 'complete',
    REJECTED: 'neutral', WITHDRAWN: 'neutral', EXPIRED: 'neutral',
    CLOSED_OTHER_ACCEPTED: 'neutral', CLOSED_LISTING_UNAVAILABLE: 'neutral',
  };
  return { tone: tone[status] ?? 'neutral', key: `adminOffers.status.${status}` };
}

export function transactionStatusLabel(status: string): Mapped {
  const tone: Record<string, StatusTone> = {
    INITIATED: 'info', CONFIRMATION: 'info', DEPOSIT: 'info', DOCUMENTS: 'info',
    DUE_DILIGENCE: 'info', TRANSFER: 'info', COMPLETION: 'info',
    COMPLETED_DEMO: 'complete', CANCELLATION_PENDING: 'attention', CANCELLED: 'neutral', FAILED: 'failed',
  };
  return { tone: tone[status] ?? 'neutral', key: `adminTransactions.status.${status}` };
}

export function customerStatusLabel(status: 'ACTIVE' | 'ACTIONS_RESTRICTED'): Mapped {
  return status === 'ACTIONS_RESTRICTED'
    ? { tone: 'attention', key: 'customers.status.restricted' }
    : { tone: 'complete', key: 'customers.status.active' };
}

export function actorTypeTone(actorType: 'ADMIN' | 'CUSTOMER' | 'SYSTEM'): StatusTone {
  return actorType === 'ADMIN' ? 'info' : actorType === 'SYSTEM' ? 'neutral' : 'complete';
}

/** Format a whole-AED amount for LTR display inside possibly-RTL text (spec §40.2). */
export function formatAed(amount: number | null): string {
  if (amount == null) return '—';
  return `AED ${amount.toLocaleString('en-AE')}`;
}

/** ISO → short readable timestamp; locale-agnostic, stable for tests. */
export function formatWhen(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toISOString().slice(0, 16).replace('T', ' ');
}

export function formatBytes(bytes: number | null): string {
  if (bytes == null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
