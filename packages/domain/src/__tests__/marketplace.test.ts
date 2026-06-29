import { describe, it, expect } from 'vitest';
import {
  marketplaceQuerySchema,
  parseMarketplaceQuery,
  bedsFilter,
  paginate,
  DEFAULT_SORT,
  MARKETPLACE_PAGE_SIZE,
} from '../marketplace';

describe('marketplaceQuerySchema', () => {
  it('coerces string query params to typed values and defaults sort/page', () => {
    const parsed = marketplaceQuerySchema.parse({ minPrice: '1000000', maxPrice: '2000000', beds: '2', page: '3' });
    expect(parsed.minPrice).toBe(1_000_000);
    expect(parsed.maxPrice).toBe(2_000_000);
    expect(parsed.beds).toBe('2');
    expect(parsed.page).toBe(3);
    expect(parsed.sort).toBe(DEFAULT_SORT);
  });

  it('rejects a price range where min exceeds max', () => {
    const r = marketplaceQuerySchema.safeParse({ minPrice: '3000000', maxPrice: '1000000' });
    expect(r.success).toBe(false);
  });

  it('rejects a size range where min exceeds max', () => {
    const r = marketplaceQuerySchema.safeParse({ minSize: '2000', maxSize: '1000' });
    expect(r.success).toBe(false);
  });

  it('treats an empty string price as absent (no filter)', () => {
    const parsed = marketplaceQuerySchema.parse({ minPrice: '', maxPrice: '' });
    expect(parsed.minPrice).toBeUndefined();
    expect(parsed.maxPrice).toBeUndefined();
  });

  it('falls back to defaults for an unknown sort and a junk page', () => {
    const parsed = marketplaceQuerySchema.parse({ sort: 'CHEAPEST', page: 'abc' });
    expect(parsed.sort).toBe(DEFAULT_SORT);
    expect(parsed.page).toBe(1);
  });
});

describe('parseMarketplaceQuery (lenient URL parse)', () => {
  it('drops an individually-invalid field but keeps the rest', () => {
    const parsed = parseMarketplaceQuery({ type: 'NOT_A_TYPE', beds: '2' });
    expect(parsed.type).toBeUndefined();
    expect(parsed.beds).toBe('2');
  });

  it('keeps a valid query intact', () => {
    const parsed = parseMarketplaceQuery({ type: 'APARTMENT', minPrice: '500000', sort: 'PRICE_ASC' });
    expect(parsed.type).toBe('APARTMENT');
    expect(parsed.minPrice).toBe(500_000);
    expect(parsed.sort).toBe('PRICE_ASC');
  });
});

describe('bedsFilter', () => {
  it('maps studio to a studio-only predicate', () => {
    expect(bedsFilter('studio')).toEqual({ studioOnly: true });
  });
  it('maps a number to a minimum predicate', () => {
    expect(bedsFilter('3')).toEqual({ min: 3 });
  });
  it('returns null for an absent value', () => {
    expect(bedsFilter(undefined)).toBeNull();
  });
});

describe('paginate', () => {
  it('computes pages of 24 and clamps an over-range page', () => {
    const p = paginate(50, 9);
    expect(p.pageSize).toBe(MARKETPLACE_PAGE_SIZE);
    expect(p.totalPages).toBe(3);
    expect(p.page).toBe(3); // clamped
    expect(p.hasNext).toBe(false);
    expect(p.hasPrev).toBe(true);
  });
  it('always reports at least one page for an empty result set', () => {
    const p = paginate(0, 1);
    expect(p.totalPages).toBe(1);
    expect(p.hasPrev).toBe(false);
    expect(p.hasNext).toBe(false);
  });
});
