import { describe, expect, it } from 'vitest';
import { withCurrentSearch } from '@/lib/locale-navigation';

describe('withCurrentSearch', () => {
  it('preserves verification and return parameters during a locale switch', () => {
    const params = new URLSearchParams({ email: 'person@example.com', next: '/sell' });
    expect(withCurrentSearch('/verify-email', params)).toBe(
      '/verify-email?email=person%40example.com&next=%2Fsell',
    );
  });

  it('does not add an empty query marker', () => {
    expect(withCurrentSearch('/sign-in', new URLSearchParams())).toBe('/sign-in');
  });
});
