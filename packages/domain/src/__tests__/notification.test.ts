import { describe, it, expect } from 'vitest';
import { OFFER_NOTIFICATION_KINDS, TRANSACTION_NOTIFICATION_KINDS, toSafeNotification } from '../notification';

const THREAD = '11111111-1111-1111-1111-111111111111';
const LISTING = '22222222-2222-2222-2222-222222222222';
const TX = '33333333-3333-3333-3333-333333333333';

describe('notification payload validation (§30 / week5 §34)', () => {
  it('accepts every known offer kind with a valid thread payload', () => {
    for (const kind of OFFER_NOTIFICATION_KINDS) {
      expect(toSafeNotification(kind, { threadId: THREAD })).toEqual({ kind, threadId: THREAD, transactionId: null, listingId: null });
    }
  });

  it('accepts every known transaction kind with a valid transaction payload', () => {
    for (const kind of TRANSACTION_NOTIFICATION_KINDS) {
      expect(toSafeNotification(kind, { transactionId: TX, listingId: null })).toEqual({ kind, threadId: null, transactionId: TX, listingId: null });
    }
  });

  it('surfaces an optional listingId (a non-sensitive navigation id)', () => {
    expect(toSafeNotification('OFFER_RECEIVED', { threadId: THREAD, listingId: LISTING })).toEqual({
      kind: 'OFFER_RECEIVED',
      threadId: THREAD,
      transactionId: null,
      listingId: LISTING,
    });
  });

  it('degrades an unknown kind to UNKNOWN with no ids', () => {
    expect(toSafeNotification('OFFER_SECRET_LEAK', { threadId: THREAD })).toEqual({
      kind: 'UNKNOWN',
      threadId: null,
      transactionId: null,
      listingId: null,
    });
  });

  it('degrades a malformed payload safely', () => {
    expect(toSafeNotification('OFFER_ACCEPTED', {})).toEqual({ kind: 'UNKNOWN', threadId: null, transactionId: null, listingId: null });
    expect(toSafeNotification('TRANSACTION_CREATED', { transactionId: 'nope' })).toEqual({
      kind: 'UNKNOWN',
      threadId: null,
      transactionId: null,
      listingId: null,
    });
    expect(toSafeNotification('TRANSACTION_CREATED', null)).toEqual({ kind: 'UNKNOWN', threadId: null, transactionId: null, listingId: null });
  });

  it('never forwards extra payload fields', () => {
    const out = toSafeNotification('TRANSACTION_COMPLETED_DEMO', {
      transactionId: TX,
      buyerEmail: 'leak@x.test',
      amount: 999,
    } as unknown);
    expect(out).toEqual({ kind: 'TRANSACTION_COMPLETED_DEMO', threadId: null, transactionId: TX, listingId: null });
  });
});
