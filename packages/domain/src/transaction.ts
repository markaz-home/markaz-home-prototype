import { z } from 'zod';

/**
 * Week-5 transaction tracker — PURE domain helpers (transaction-tracker-design-spec).
 * Server-authoritative enforcement lives in the SQL SECURITY DEFINER functions
 * (migrations 08.8/08.9); these are copy-mapping + derivation helpers shared by the API
 * and UI. Raw enum values are never shown to users — they map to translation keys.
 */

// ---- Enums -----------------------------------------------------------------
export const TRANSACTION_STATUSES = [
  'INITIATED',
  'CONFIRMATION',
  'DEPOSIT',
  'DOCUMENTS',
  'DUE_DILIGENCE',
  'TRANSFER',
  'COMPLETION',
  'COMPLETED_DEMO',
  'CANCELLATION_PENDING',
  'CANCELLED',
  'FAILED',
] as const;
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

export const TRANSACTION_NEXT_ACTORS = ['BUYER', 'SELLER', 'BOTH', 'SYSTEM', 'NONE'] as const;
export type TransactionNextActor = (typeof TRANSACTION_NEXT_ACTORS)[number];

export const TRANSACTION_ACTORS = ['BUYER', 'SELLER', 'BOTH', 'SYSTEM'] as const;
export type TransactionActor = (typeof TRANSACTION_ACTORS)[number];

export const TRANSACTION_TASK_STATUSES = [
  'PENDING',
  'ACTION_REQUIRED',
  'IN_PROGRESS',
  'COMPLETED_DEMO',
  'BLOCKED',
  'FAILED',
  'SKIPPED',
] as const;
export type TransactionTaskStatus = (typeof TRANSACTION_TASK_STATUSES)[number];

export const PURCHASE_ROUTES = ['CASH', 'FINANCING'] as const;
export type PurchaseRoute = (typeof PURCHASE_ROUTES)[number];
export const purchaseRouteSchema = z.enum(PURCHASE_ROUTES);

export const FINANCING_STATUSES = [
  'NOT_STARTED',
  'IN_PROGRESS',
  'CONFIRMED_DEMO',
  'UNABLE_TO_PROCEED',
] as const;
export type FinancingStatus = (typeof FINANCING_STATUSES)[number];
export const financingStatusSchema = z.enum(FINANCING_STATUSES);

export const CANCELLATION_REASONS = [
  'BUYER_UNABLE',
  'SELLER_UNABLE',
  'FINANCING_FAILED',
  'DOCUMENTS_INCOMPLETE',
  'MUTUAL',
  'OTHER',
] as const;
export type CancellationReason = (typeof CANCELLATION_REASONS)[number];
export const cancellationReasonSchema = z.enum(CANCELLATION_REASONS);

// ---- Stages ----------------------------------------------------------------
/** The six user-facing progress stages (INITIATED is shown as the first, Confirm stage). */
export const TRANSACTION_STAGES = [
  'CONFIRMATION',
  'DEPOSIT',
  'DOCUMENTS',
  'DUE_DILIGENCE',
  'TRANSFER',
  'COMPLETION',
] as const;
export type TransactionStage = (typeof TRANSACTION_STAGES)[number];

/** Map a raw status to the stage index (0-based) for the progress tracker. */
export function stageIndex(status: TransactionStatus): number {
  if (status === 'INITIATED') return 0;
  if (status === 'COMPLETED_DEMO') return TRANSACTION_STAGES.length; // all complete
  const idx = (TRANSACTION_STAGES as readonly string[]).indexOf(status);
  return idx >= 0 ? idx : 0;
}

export const TERMINAL_STATUSES: readonly TransactionStatus[] = [
  'COMPLETED_DEMO',
  'CANCELLED',
  'FAILED',
];
export function isTerminal(status: TransactionStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

// ---- Task catalogue --------------------------------------------------------
export interface TaskMeta {
  code: string;
  stage: TransactionStage;
  actor: TransactionActor;
  sequence: number;
  /** Required for the FINANCING route only. */
  conditional?: 'FINANCING';
}

export const TASK_CATALOGUE: readonly TaskMeta[] = [
  { code: 'BUYER_CONFIRM_DETAILS', stage: 'CONFIRMATION', actor: 'BUYER', sequence: 10 },
  { code: 'SELLER_CONFIRM_DETAILS', stage: 'CONFIRMATION', actor: 'SELLER', sequence: 11 },
  { code: 'BUYER_SELECT_ROUTE', stage: 'CONFIRMATION', actor: 'BUYER', sequence: 12 },
  { code: 'BUYER_CONFIRM_DEPOSIT', stage: 'DEPOSIT', actor: 'BUYER', sequence: 20 },
  { code: 'BUYER_DOCUMENTS', stage: 'DOCUMENTS', actor: 'BUYER', sequence: 30 },
  { code: 'SELLER_DOCUMENTS', stage: 'DOCUMENTS', actor: 'SELLER', sequence: 31 },
  {
    code: 'BUYER_FINANCING',
    stage: 'DOCUMENTS',
    actor: 'BUYER',
    sequence: 32,
    conditional: 'FINANCING',
  },
  { code: 'BUYER_REVIEW_SUMMARY', stage: 'DOCUMENTS', actor: 'BUYER', sequence: 33 },
  { code: 'SELLER_REVIEW_SUMMARY', stage: 'DOCUMENTS', actor: 'SELLER', sequence: 34 },
  { code: 'DUE_DILIGENCE', stage: 'DUE_DILIGENCE', actor: 'SYSTEM', sequence: 40 },
  { code: 'SELLER_PROPOSE_DATE', stage: 'TRANSFER', actor: 'SELLER', sequence: 50 },
  { code: 'BUYER_CONFIRM_READINESS', stage: 'TRANSFER', actor: 'BUYER', sequence: 51 },
  { code: 'SELLER_CONFIRM_READINESS', stage: 'TRANSFER', actor: 'SELLER', sequence: 52 },
  { code: 'TRANSFER_APPOINTMENT', stage: 'TRANSFER', actor: 'SYSTEM', sequence: 53 },
  { code: 'BUYER_CONFIRM_COMPLETION', stage: 'COMPLETION', actor: 'BUYER', sequence: 60 },
  { code: 'SELLER_CONFIRM_COMPLETION', stage: 'COMPLETION', actor: 'SELLER', sequence: 61 },
  { code: 'TRANSACTION_COMPLETE', stage: 'COMPLETION', actor: 'SYSTEM', sequence: 62 },
];

/** The tasks that count toward progress for a chosen route (financing only when relevant). */
export function requiredTaskCodes(route: PurchaseRoute | null): string[] {
  return TASK_CATALOGUE.filter(
    (t) => !t.conditional || (t.conditional === 'FINANCING' && route === 'FINANCING'),
  ).map((t) => t.code);
}

// ---- Money -----------------------------------------------------------------
export const DEPOSIT_PERCENT = 0.1;
/** Server-authoritative demo deposit = 10% of accepted amount, 2dp (display only). */
export function depositAmount(acceptedAmountAed: number): number {
  return Math.round(acceptedAmountAed * DEPOSIT_PERCENT * 100) / 100;
}

// ---- Reference -------------------------------------------------------------
const REFERENCE_RE = /^MKZ-TXN-\d{4}-\d{6}$/;
export function isValidTransactionReference(ref: string): boolean {
  return REFERENCE_RE.test(ref);
}

// ---- Progress --------------------------------------------------------------
export interface ProgressInput {
  code: string;
  status: TransactionTaskStatus;
  required: boolean;
}
/** Completed required (non-skipped) tasks / all required (non-skipped) tasks. */
export function computeProgress(tasks: ProgressInput[]): {
  completed: number;
  total: number;
  ratio: number;
} {
  const relevant = tasks.filter((t) => t.required && t.status !== 'SKIPPED');
  const total = relevant.length;
  const completed = relevant.filter((t) => t.status === 'COMPLETED_DEMO').length;
  return { completed, total, ratio: total === 0 ? 0 : completed / total };
}

/** Stage-level completion for the "N of 6 stages complete" tracker. */
export function completedStageCount(status: TransactionStatus): number {
  if (status === 'COMPLETED_DEMO') return TRANSACTION_STAGES.length;
  return stageIndex(status);
}

// ---- Perspective / actor copy ---------------------------------------------
export type Perspective = 'BUYER' | 'SELLER';

/** i18n key for the next-action headline, from the viewer's perspective (spec §10.3). */
export function nextActorKey(nextActor: TransactionNextActor, perspective: Perspective): string {
  switch (nextActor) {
    case 'BOTH':
      return 'nextActor.both';
    case 'SYSTEM':
      return 'nextActor.system';
    case 'NONE':
      return 'nextActor.none';
    case 'BUYER':
      return perspective === 'BUYER' ? 'nextActor.you' : 'nextActor.waitingBuyer';
    case 'SELLER':
      return perspective === 'SELLER' ? 'nextActor.you' : 'nextActor.waitingSeller';
  }
}

/** i18n key for a task's ownership label from the viewer's perspective (spec §9.3). */
export function taskOwnershipKey(
  actor: TransactionActor,
  status: TransactionTaskStatus,
  perspective: Perspective,
): string {
  if (status === 'COMPLETED_DEMO') return 'task.completed';
  if (status === 'SKIPPED') return 'task.skipped';
  if (status === 'BLOCKED') return 'task.blocked';
  if (status === 'FAILED') return 'task.failed';
  switch (actor) {
    case 'SYSTEM':
      return 'task.system';
    case 'BOTH':
      return 'task.both';
    case 'BUYER':
      return perspective === 'BUYER' ? 'task.you' : 'task.buyer';
    case 'SELLER':
      return perspective === 'SELLER' ? 'task.you' : 'task.seller';
  }
}

/** User-facing status label key — raw enum values are never shown (spec §8). */
export function transactionStatusKey(status: TransactionStatus): string {
  const map: Record<TransactionStatus, string> = {
    INITIATED: 'status.initiated',
    CONFIRMATION: 'status.confirmation',
    DEPOSIT: 'status.deposit',
    DOCUMENTS: 'status.documents',
    DUE_DILIGENCE: 'status.dueDiligence',
    TRANSFER: 'status.transfer',
    COMPLETION: 'status.completion',
    COMPLETED_DEMO: 'status.completed',
    CANCELLATION_PENDING: 'status.cancellationPending',
    CANCELLED: 'status.cancelled',
    FAILED: 'status.failed',
  };
  return map[status];
}

// ---- Cancellation policy ---------------------------------------------------
/** Unilateral (immediate) cancellation only while pre-deposit and before both confirm (spec §30.2). */
export function canCancelUnilaterally(
  status: TransactionStatus,
  bothDetailsConfirmed: boolean,
): boolean {
  return (status === 'INITIATED' || status === 'CONFIRMATION') && !bothDetailsConfirmed;
}

// ---- Document types --------------------------------------------------------
export const TRANSACTION_DOCUMENT_TYPES = [
  'BUYER_IDENTITY',
  'BUYER_TRANSACTION_FILE',
  'BUYER_FINANCING',
  'SELLER_IDENTITY',
  'SELLER_TRANSACTION_FILE',
] as const;
export type TransactionDocumentType = (typeof TRANSACTION_DOCUMENT_TYPES)[number];
export const transactionDocumentTypeSchema = z.enum(TRANSACTION_DOCUMENT_TYPES);

export const ALLOWED_DOCUMENT_MIME = ['application/pdf', 'image/jpeg', 'image/png'] as const;
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

export function isBuyerDocumentType(t: TransactionDocumentType): boolean {
  return t.startsWith('BUYER_');
}
