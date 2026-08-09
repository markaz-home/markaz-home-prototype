import { describe, expect, it } from 'vitest';
import { isCustomerEmailVerified, resolveCustomerEmail } from '@/lib/customer-email';

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

describe('isCustomerEmailVerified', () => {
  it('trusts the projected email for a provider-only UAE PASS account', () => {
    expect(
      isCustomerEmailVerified({
        email: 'uae-pass@markaz.test',
        authEmailVerified: false,
        uaePassAuthenticated: true,
        emailPasswordAuthenticated: false,
      }),
    ).toBe(true);
  });

  it('uses Supabase confirmation for a native email identity', () => {
    expect(
      isCustomerEmailVerified({
        email: 'native@markaz.test',
        authEmailVerified: false,
        uaePassAuthenticated: true,
        emailPasswordAuthenticated: true,
      }),
    ).toBe(false);
    expect(
      isCustomerEmailVerified({
        email: 'native@markaz.test',
        authEmailVerified: true,
        uaePassAuthenticated: false,
        emailPasswordAuthenticated: true,
      }),
    ).toBe(true);
  });

  it('never verifies a missing display email', () => {
    expect(
      isCustomerEmailVerified({
        email: null,
        authEmailVerified: true,
        uaePassAuthenticated: true,
        emailPasswordAuthenticated: false,
      }),
    ).toBe(false);
  });
});
