import { z } from 'zod';

/** Transaction advances strictly forward. Created at ACCEPTANCE. */
export const TRANSACTION_STAGES = [
  'OFFER',
  'ACCEPTANCE',
  'MOU',
  'DEPOSIT',
  'NOC',
  'TRANSFER',
  'HANDOVER',
  'COMPLETE_DEMO',
] as const;
export type TransactionStage = (typeof TRANSACTION_STAGES)[number];
export const transactionStageSchema = z.enum(TRANSACTION_STAGES);

const ORDER: TransactionStage[] = [...TRANSACTION_STAGES];

/** Transactions only ever advance to the immediately following stage. */
export function canAdvanceTransaction(from: TransactionStage, to: TransactionStage): boolean {
  const fromIdx = ORDER.indexOf(from);
  const toIdx = ORDER.indexOf(to);
  return toIdx === fromIdx + 1;
}

export function nextStage(stage: TransactionStage): TransactionStage | null {
  const idx = ORDER.indexOf(stage);
  return ORDER[idx + 1] ?? null;
}

export function isTransactionComplete(stage: TransactionStage): boolean {
  return stage === 'COMPLETE_DEMO';
}
