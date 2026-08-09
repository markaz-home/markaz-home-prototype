import { describe, expect, it } from 'vitest';
import { resolveCustomerEmail } from '@/lib/customer-email';

describe('resolveCustomerEmail', () => {
  it('prefers the native Auth email for password accounts', () => {
    expect(resolveCustomerEmail('auth@markaz.test', 'profile@markaz.test')).toBe(
      'auth@markaz.test',
    );
  });

  it('uses the profile email projected from UAE PASS', () => {
    expect(resolveCustomerEmail(null, 'uae-pass@markaz.test')).toBe('uae-pass@markaz.test');
  });

  it('does not expose the internal no-email placeholder', () => {
    expect(
      resolveCustomerEmail(null, '6564f650-fff0-4de9-9dcc-26a72f304c4d@no-email.uaepass.invalid'),
    ).toBeNull();
  });
});
