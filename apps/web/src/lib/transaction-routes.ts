import {
  TRANSACTION_STAGES,
  type TransactionStage,
  type TransactionStatus,
} from '@markaz/domain';

export const TRANSACTION_STAGE_ROUTES = [
  { stage: 'CONFIRMATION', slug: 'confirm' },
  { stage: 'DEPOSIT', slug: 'deposit' },
  { stage: 'DOCUMENTS', slug: 'documents' },
  { stage: 'DUE_DILIGENCE', slug: 'checks' },
  { stage: 'TRANSFER', slug: 'transfer' },
  { stage: 'COMPLETION', slug: 'completion' },
] as const satisfies readonly { stage: TransactionStage; slug: string }[];

export type TransactionStageSlug = (typeof TRANSACTION_STAGE_ROUTES)[number]['slug'];

export function stageFromSlug(slug: string): TransactionStage | null {
  return TRANSACTION_STAGE_ROUTES.find((item) => item.slug === slug)?.stage ?? null;
}

export function slugForStage(stage: TransactionStage): TransactionStageSlug {
  return TRANSACTION_STAGE_ROUTES.find((item) => item.stage === stage)?.slug ?? 'confirm';
}

export function stageForStatus(status: TransactionStatus): TransactionStage {
  if (status === 'INITIATED' || status === 'CANCELLATION_PENDING') return 'CONFIRMATION';
  if (status === 'COMPLETED_DEMO' || status === 'CANCELLED' || status === 'FAILED')
    return 'COMPLETION';
  return (TRANSACTION_STAGES as readonly string[]).includes(status)
    ? (status as TransactionStage)
    : 'CONFIRMATION';
}

export function transactionStageHref(
  transactionId: string,
  stage: TransactionStage,
): `/transactions/${string}/${TransactionStageSlug}` {
  return `/transactions/${transactionId}/${slugForStage(stage)}`;
}
