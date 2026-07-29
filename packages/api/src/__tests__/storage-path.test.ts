import { describe, expect, it } from 'vitest';
import { isOwnedListingStoragePath } from '../storage-path';

const input = {
  userId: '11111111-1111-4111-8111-111111111111',
  listingId: '22222222-2222-4222-8222-222222222222',
};

describe('listing Storage object ownership', () => {
  it('accepts the canonical customer/listing/object key', () => {
    expect(
      isOwnedListingStoragePath({
        ...input,
        path: `${input.userId}/${input.listingId}/photo.png`,
      }),
    ).toBe(true);
  });

  it('rejects cross-customer and cross-listing object keys', () => {
    expect(
      isOwnedListingStoragePath({
        ...input,
        path: `33333333-3333-4333-8333-333333333333/${input.listingId}/photo.png`,
      }),
    ).toBe(false);
    expect(
      isOwnedListingStoragePath({
        ...input,
        path: `${input.userId}/44444444-4444-4444-8444-444444444444/photo.png`,
      }),
    ).toBe(false);
  });

  it('rejects empty, traversal-like, and control-character segments', () => {
    for (const suffix of ['', '../photo.png', 'folder//photo.png', 'photo\u0000.png']) {
      expect(
        isOwnedListingStoragePath({
          ...input,
          path: `${input.userId}/${input.listingId}/${suffix}`,
        }),
      ).toBe(false);
    }
  });
});
