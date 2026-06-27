import { describe, it, expect, afterEach } from 'vitest';
import { getPublicSupabaseConfig } from '../env';
import { assertAccountType, AuthorizationError } from '../rbac';

const ORIGINAL = { ...process.env };
afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe('public supabase env validation', () => {
  it('throws clearly when public config is missing', () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    expect(() => getPublicSupabaseConfig()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });
  it('returns config when present', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
    expect(getPublicSupabaseConfig()).toEqual({ url: 'http://localhost:54321', anonKey: 'anon' });
  });
});

describe('rbac assertions', () => {
  it('allows the matching account type', () => {
    expect(() => assertAccountType('ADMIN', 'ADMIN')).not.toThrow();
  });
  it('rejects a customer reaching admin', () => {
    expect(() => assertAccountType('CUSTOMER', 'ADMIN')).toThrow(AuthorizationError);
  });
  it('rejects unauthenticated', () => {
    try {
      assertAccountType(undefined, 'ADMIN');
      throw new Error('should have thrown');
    } catch (e) {
      expect((e as AuthorizationError).code).toBe('UNAUTHENTICATED');
    }
  });
});
