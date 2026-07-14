import { describe, it, expect } from 'vitest';
import { maskEmail, toAuditEvent, toAdminCustomerListItem, toAdminDocumentMetadata } from '../admin-projection';

describe('admin projection privacy (§35, §42.1)', () => {
  it('masks a customer email for list views', () => {
    expect(maskEmail('taniagole@example.com')).toBe('ta•••••••@example.com');
    expect(maskEmail('a@b.com')).toBe('a•@b.com');
  });

  it('customer list item never leaks the raw email or phone; derives status + attention', () => {
    const item = toAdminCustomerListItem({
      id: 'c1', fullName: 'Sam Buyer', email: 'sam@x.test', restricted: true, onboarded: true,
      identityStatus: 'VERIFIED_DEMO', createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-07-01'),
      listingCount: 0, activeOfferCount: 0, activeTransactionCount: 2,
    });
    expect(item.status).toBe('ACTIONS_RESTRICTED');
    expect(item.statusKey).toBe('customers.status.restricted');
    expect(item.attention).toBe(true); // restricted + active transaction
    expect(JSON.stringify(item)).not.toContain('sam@x.test');
    expect(item.emailMasked).toContain('•');
  });

  it('audit projection allow-lists metadata (no tokens/paths/raw errors)', () => {
    const ev = toAuditEvent({
      id: 'a1', actorId: 'adm1', action: 'ADMIN_PRIVATE_DOCUMENT_ACCESSED', entityType: 'transaction', entityId: 't1',
      metadata: { reason: 'VERIFICATION_REVIEW', documentType: 'OWNERSHIP', signedUrl: 'https://secret', storagePath: 'bucket/x', token: 'abc', stack: 'Error: boom' },
      createdAt: new Date('2026-07-01T00:00:00Z'),
    });
    expect(ev.actorType).toBe('ADMIN');
    expect(ev.metadata).toEqual({ reason: 'VERIFICATION_REVIEW', documentType: 'OWNERSHIP' });
    const json = JSON.stringify(ev);
    expect(json).not.toContain('secret');
    expect(json).not.toContain('storagePath');
    expect(json).not.toContain('token');
    expect(json).not.toContain('boom');
  });

  it('actor type is CUSTOMER for a non-admin action and SYSTEM when no actor', () => {
    expect(toAuditEvent({ id: 'a', actorId: 'u', action: 'OFFER_ACCEPTED', entityType: 'offer_thread', entityId: 'x', metadata: {}, createdAt: new Date() }).actorType).toBe('CUSTOMER');
    expect(toAuditEvent({ id: 'a', actorId: null, action: 'OFFER_EXPIRED', entityType: 'offer_thread', entityId: 'x', metadata: {}, createdAt: new Date() }).actorType).toBe('SYSTEM');
  });

  it('document metadata never exposes the raw storage path', () => {
    const d = toAdminDocumentMetadata({
      id: 'd1', documentType: 'BUYER_IDENTITY', uploadedBy: 'u1', status: 'ACCEPTED_DEMO', mimeType: 'application/pdf',
      sizeBytes: 1000, fileName: 'id.pdf', visibility: 'PRIVATE_TO_UPLOADER', createdAt: new Date(),
    });
    expect(d).not.toHaveProperty('storagePath');
    expect(d.fileName).toBe('id.pdf');
    expect(d.visibility).toBe('PRIVATE_TO_UPLOADER');
  });
});
