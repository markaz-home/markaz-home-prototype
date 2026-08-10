import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { renderNotificationEmail } from '@/server/notification-email';

const base = {
  recipientName: 'Tania Gole',
  recipientPerspective: 'SELLER' as const,
  property: 'Burj Vista <script>alert(1)</script>',
  amountAed: 2_500_000,
  reference: null,
  coverUrl: 'https://example.test/property.jpg',
  actionUrl: 'https://markazhome.com/en/offers/11111111-1111-1111-1111-111111111111',
  locale: 'en',
};

describe('branded notification email', () => {
  it('renders a safe, branded offer email with property, amount, image, and CTA', () => {
    const email = renderNotificationEmail({ ...base, kind: 'OFFER_RECEIVED' });

    expect(email.subject).toContain('offer');
    expect(email.html).toContain('MARKAZ HOME');
    expect(email.html).toContain('src="https://markazhome.com/markaz-logo-gold.png"');
    expect(email.html).not.toContain('A clearer way to move property forward.');
    expect(email.html).toContain('https://example.test/property.jpg');
    expect(email.html).toContain('2,500,000');
    expect(email.html).toContain(base.actionUrl);
    expect(email.html).not.toContain('<script>alert(1)</script>');
    expect(email.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(email.text).toContain('Burj Vista <script>alert(1)</script>');
  });

  it('gives buyer and seller distinct accepted-offer copy with the shared reference', () => {
    const buyer = renderNotificationEmail({
      ...base,
      kind: 'TRANSACTION_CREATED',
      recipientPerspective: 'BUYER',
      reference: 'MKZ-TXN-2026-000001',
    });
    const seller = renderNotificationEmail({
      ...base,
      kind: 'TRANSACTION_CREATED',
      recipientPerspective: 'SELLER',
      reference: 'MKZ-TXN-2026-000001',
    });

    expect(buyer.subject).not.toBe(seller.subject);
    expect(buyer.text).toContain('MKZ-TXN-2026-000001');
    expect(seller.text).toContain('MKZ-TXN-2026-000001');
    expect(buyer.text).toContain('Continue transaction');
    expect(seller.text).toContain('Continue transaction');
  });

  it('renders a right-to-left Arabic reminder without changing the canonical URL', () => {
    const email = renderNotificationEmail({
      ...base,
      kind: 'TRANSACTION_REMINDER',
      locale: 'ar',
      reminderHours: 24,
    });

    expect(email.html).toContain('lang="ar" dir="rtl"');
    expect(email.html).toContain(base.actionUrl);
    expect(email.html).not.toContain('طريقة أوضح للمضي في رحلتك العقارية.');
    expect(email.subject.length).toBeGreaterThan(0);
  });
});
