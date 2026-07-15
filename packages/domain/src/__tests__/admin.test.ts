import { describe, it, expect } from 'vitest';
import {
  ADMIN_CAPABILITIES,
  PROTOTYPE_ADMIN_CAPABILITIES,
  hasCapability,
  adminNoteBodySchema,
  restrictReasonSchema,
  customerStatusKey,
} from '../admin';

describe('admin capability model (§5)', () => {
  it('defines the 16 capabilities and the prototype admin holds all of them', () => {
    expect(ADMIN_CAPABILITIES).toHaveLength(16);
    expect(PROTOTYPE_ADMIN_CAPABILITIES).toEqual(ADMIN_CAPABILITIES);
    expect(hasCapability(PROTOTYPE_ADMIN_CAPABILITIES, 'ACCESS_PRIVATE_DOCUMENT')).toBe(true);
  });
  it('reports a missing capability as false', () => {
    expect(hasCapability(['VIEW_OVERVIEW'], 'MANAGE_CUSTOMER_STATUS')).toBe(false);
  });
  it('validates admin note body length (3–1000)', () => {
    expect(adminNoteBodySchema.safeParse('ok').success).toBe(false);
    expect(adminNoteBodySchema.safeParse('valid note').success).toBe(true);
    expect(adminNoteBodySchema.safeParse('x'.repeat(1001)).success).toBe(false);
  });
  it('validates a structured restrict reason and rejects free text', () => {
    expect(restrictReasonSchema.safeParse('ACCOUNT_REVIEW').success).toBe(true);
    expect(restrictReasonSchema.safeParse('because I said so').success).toBe(false);
  });
  it('maps customer status to a safe i18n key (never the internal reason)', () => {
    expect(customerStatusKey(true)).toBe('customers.status.restricted');
    expect(customerStatusKey(false)).toBe('customers.status.active');
  });
});
