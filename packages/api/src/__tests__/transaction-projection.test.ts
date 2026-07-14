import { describe, it, expect } from 'vitest';
import { toTransactionDetail, type TxRow, type TaskRow, type DocRow } from '../transaction-projection';

const BUYER = 'b0000000-0000-0000-0000-000000000000';
const SELLER = 's0000000-0000-0000-0000-000000000000';

const row = (over: Partial<TxRow> = {}): TxRow => ({
  id: 't1',
  reference: 'MKZ-TXN-2026-000001',
  status: 'DOCUMENTS',
  nextActor: 'BOTH',
  buyerUserId: BUYER,
  sellerUserId: SELLER,
  acceptedAmountAed: '2000000.00',
  purchaseRoute: 'CASH',
  financingStatus: null,
  depositAmountAed: '200000.00',
  depositConfirmedAt: new Date('2026-07-01T00:00:00Z'),
  transferPreferredDate: null,
  transferAppointmentAt: null,
  cancellationReason: null,
  cancellationRequestedBy: null,
  failureCategory: null,
  version: 5,
  startedAt: new Date(),
  completedAt: null,
  cancelledAt: null,
  createdAt: new Date('2026-07-01T00:00:00Z'),
  updatedAt: new Date('2026-07-02T00:00:00Z'),
  ...over,
});

const tasks: TaskRow[] = [
  { code: 'BUYER_DOCUMENTS', stage: 'DOCUMENTS', sequence: 30, assignedActor: 'BUYER', required: true, status: 'ACTION_REQUIRED', completedAt: null },
  { code: 'SELLER_DOCUMENTS', stage: 'DOCUMENTS', sequence: 31, assignedActor: 'SELLER', required: true, status: 'COMPLETED_DEMO', completedAt: new Date() },
  { code: 'BUYER_FINANCING', stage: 'DOCUMENTS', sequence: 32, assignedActor: 'BUYER', required: false, status: 'SKIPPED', completedAt: null },
];

const buyerDoc: DocRow = {
  id: 'd1',
  uploadedBy: BUYER,
  documentType: 'BUYER_IDENTITY',
  fileName: 'my-id.pdf',
  status: 'UPLOADED',
  createdAt: new Date(),
};
const sellerDoc: DocRow = {
  id: 'd2',
  uploadedBy: SELLER,
  documentType: 'SELLER_IDENTITY',
  fileName: 'seller-secret.pdf',
  status: 'UPLOADED',
  createdAt: new Date(),
};

describe('transaction projection privacy (§42)', () => {
  it('reduces the other participant documents to per-type completeness only', () => {
    const view = toTransactionDetail({
      row: row(),
      userId: BUYER,
      property: null,
      tasks,
      events: [],
      ownDocuments: [buyerDoc],
      otherDocuments: [sellerDoc],
    });
    // Buyer sees own file metadata...
    expect(view.ownDocuments).toHaveLength(1);
    expect(view.ownDocuments[0]?.fileName).toBe('my-id.pdf');
    // ...but only completeness for the seller's file — never its filename.
    expect(view.otherChecklist).toEqual({ SELLER_IDENTITY: 'COMPLETE' });
    expect(JSON.stringify(view)).not.toContain('seller-secret.pdf');
  });

  it('never leaks participant user ids in the DTO', () => {
    const view = toTransactionDetail({ row: row(), userId: BUYER, property: null, tasks, events: [], ownDocuments: [], otherDocuments: [] });
    const json = JSON.stringify(view);
    expect(json).not.toContain(BUYER);
    expect(json).not.toContain(SELLER);
  });

  it('is perspective-aware: buyer vs seller see the same facts, own actions', () => {
    const buyerView = toTransactionDetail({ row: row(), userId: BUYER, property: null, tasks, events: [], ownDocuments: [], otherDocuments: [] });
    const sellerView = toTransactionDetail({ row: row(), userId: SELLER, property: null, tasks, events: [], ownDocuments: [], otherDocuments: [] });
    expect(buyerView.perspective).toBe('BUYER');
    expect(sellerView.perspective).toBe('SELLER');
    expect(buyerView.acceptedAmountAed).toBe(sellerView.acceptedAmountAed);
    // The buyer's document task is "mine" for the buyer, not the seller.
    expect(buyerView.tasks.find((t) => t.code === 'BUYER_DOCUMENTS')?.mine).toBe(true);
    expect(sellerView.tasks.find((t) => t.code === 'BUYER_DOCUMENTS')?.mine).toBe(false);
  });

  it('omits skipped tasks and computes progress on required non-skipped tasks', () => {
    const view = toTransactionDetail({ row: row(), userId: BUYER, property: null, tasks, events: [], ownDocuments: [], otherDocuments: [] });
    expect(view.tasks.find((t) => t.code === 'BUYER_FINANCING')).toBeUndefined();
    expect(view.progress).toEqual({ completed: 1, total: 2, ratio: 0.5 });
  });

  it('exposes a cancellation summary with the requester side (no user id)', () => {
    const view = toTransactionDetail({
      row: row({ status: 'CANCELLATION_PENDING', cancellationRequestedBy: BUYER, cancellationReason: 'BUYER_UNABLE' }),
      userId: SELLER,
      property: null,
      tasks,
      events: [],
      ownDocuments: [],
      otherDocuments: [],
    });
    expect(view.cancellation).toEqual({ reason: 'BUYER_UNABLE', requestedBySide: 'BUYER', pending: true });
  });
});
