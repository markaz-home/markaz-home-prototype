import { describe, it, expect } from 'vitest';
import {
  listingStateLabel, publicationStatusLabel, verificationStatusLabel, offerStatusLabel,
  transactionStatusLabel, customerStatusLabel, actorTypeTone, formatAed, formatWhen, formatBytes,
} from '@/components/admin/labels';

describe('admin label maps (spec §35 — no raw enums in UI)', () => {
  it('maps known enum values to a tone + namespaced key', () => {
    expect(listingStateLabel('LIVE')).toEqual({ tone: 'complete', key: 'listings.state.LIVE' });
    expect(publicationStatusLabel('PENDING')).toEqual({ tone: 'attention', key: 'publication.status.PENDING' });
    expect(verificationStatusLabel('FAILED_DEMO')).toEqual({ tone: 'failed', key: 'verifications.status.FAILED_DEMO' });
    expect(offerStatusLabel('ACCEPTED')).toEqual({ tone: 'complete', key: 'adminOffers.status.ACCEPTED' });
    expect(transactionStatusLabel('FAILED')).toEqual({ tone: 'failed', key: 'adminTransactions.status.FAILED' });
  });

  it('falls back to neutral for an unknown enum so a new server value cannot crash a page', () => {
    expect(listingStateLabel('SOME_FUTURE_STATE').tone).toBe('neutral');
    expect(transactionStatusLabel('WAT').tone).toBe('neutral');
  });

  it('derives customer status tone/key from the restricted flag', () => {
    expect(customerStatusLabel('ACTIONS_RESTRICTED')).toEqual({ tone: 'attention', key: 'customers.status.restricted' });
    expect(customerStatusLabel('ACTIVE')).toEqual({ tone: 'complete', key: 'customers.status.active' });
  });

  it('assigns actor tones', () => {
    expect(actorTypeTone('ADMIN')).toBe('info');
    expect(actorTypeTone('SYSTEM')).toBe('neutral');
    expect(actorTypeTone('CUSTOMER')).toBe('complete');
  });

  it('formats amounts LTR with thousands separators and a dash for null', () => {
    expect(formatAed(1250000)).toBe('AED 1,250,000');
    expect(formatAed(null)).toBe('—');
  });

  it('formats timestamps deterministically and guards bad input', () => {
    expect(formatWhen('2026-07-01T09:30:00.000Z')).toBe('2026-07-01 09:30');
    expect(formatWhen(null)).toBe('—');
    expect(formatWhen('not-a-date')).toBe('—');
  });

  it('formats byte sizes', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(3 * 1024 * 1024)).toBe('3.0 MB');
    expect(formatBytes(null)).toBe('—');
  });
});
