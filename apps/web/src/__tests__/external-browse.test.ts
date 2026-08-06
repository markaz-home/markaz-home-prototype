import { describe, expect, it } from 'vitest';
import { shouldShowExternalInventory } from '@/components/marketplace/external-browse';

describe('authenticated marketplace inventory scope', () => {
  it('keeps signed-in Browse Properties limited to MARKAZ listings', () => {
    expect(shouldShowExternalInventory(true)).toBe(false);
  });

  it('retains external discovery inventory for anonymous visitors', () => {
    expect(shouldShowExternalInventory(false)).toBe(true);
  });
});
