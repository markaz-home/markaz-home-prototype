import { describe, it, expect } from 'vitest';
import {
  publicationChecklist,
  isPublicationEligible,
  classifyLiveEdit,
  canPause,
  canResume,
  resumeRequiresReview,
  buildListingSlug,
  bedroomLabel,
  formatPublicId,
} from '../publication';
import {
  marketplaceQuerySchema,
  parseMarketplaceQuery,
  paginate,
  bedsFilter,
  DEFAULT_SORT,
  MARKETPLACE_PAGE_SIZE,
} from '../marketplace';
import type { ListingProgressInput } from '../listing-progress';

const ready: ListingProgressInput = {
  state: 'READY_TO_PUBLISH',
  detailsComplete: true,
  hasActiveDocument: true,
  verification: { status: 'VERIFIED', fresh: true },
  settingsComplete: true,
  investment: { status: 'SKIPPED' },
  formA: { status: 'COMPLETE', fresh: true },
  photos: { count: 6, hasCover: true },
  permit: { status: 'APPROVED', fresh: true },
  reviewConfirmed: true,
};

describe('publication eligibility + checklist', () => {
  it('a fully ready listing with a valid price is eligible; checklist all complete', () => {
    const c = publicationChecklist(ready, 2_100_000);
    expect(Object.values(c).every((v) => v === 'COMPLETE')).toBe(true);
    expect(isPublicationEligible(ready, 2_100_000)).toBe(true);
  });
  it('blocks when the price is missing or photos lack a cover', () => {
    expect(isPublicationEligible(ready, null)).toBe(false);
    expect(publicationChecklist(ready, 0).price).toBe('INCOMPLETE');
    expect(publicationChecklist({ ...ready, photos: { count: 3, hasCover: false } }, 2_100_000).cover).toBe('INCOMPLETE');
    expect(isPublicationEligible({ ...ready, permit: { status: 'PENDING', fresh: true } }, 2_100_000)).toBe(false);
  });
});

describe('live-edit classification (§17.4)', () => {
  it('treats description/amenities/order/cover/IC-visibility as non-material', () => {
    for (const f of ['description', 'features', 'photoOrder', 'cover', 'investmentVisibility']) {
      expect(classifyLiveEdit(f)).toBe('NON_MATERIAL');
    }
  });
  it('treats price/location/facts/document/photo-files as material (default material)', () => {
    for (const f of ['askingPrice', 'community', 'propertyType', 'bedrooms', 'document', 'photoFiles', 'furnishing', 'anythingElse']) {
      expect(classifyLiveEdit(f)).toBe('MATERIAL');
    }
  });
});

describe('pause / resume', () => {
  it('pause from LIVE, resume from PAUSED only', () => {
    expect(canPause('LIVE')).toBe(true);
    expect(canPause('PAUSED')).toBe(false);
    expect(canResume('PAUSED')).toBe(true);
    expect(canResume('LIVE')).toBe(false);
  });
  it('resume requires review only after material changes while paused', () => {
    expect(resumeRequiresReview(true)).toBe(true);
    expect(resumeRequiresReview(false)).toBe(false);
  });
});

describe('public slug + id', () => {
  it('builds a public, unit-free slug from public fields', () => {
    expect(buildListingSlug({ bedrooms: 2, propertyType: 'APARTMENT', community: 'Dubai Marina' })).toBe('2-bedroom-apartment-dubai-marina');
    expect(buildListingSlug({ bedrooms: 0, propertyType: 'APARTMENT', community: 'Business Bay' })).toBe('studio-apartment-business-bay');
    expect(bedroomLabel(3)).toBe('3-bedroom');
    // Structural privacy: the signature accepts only public fields — there is no
    // unitIdentifier parameter, so a unit number can never reach the slug.
    expect(buildListingSlug({ bedrooms: 2, propertyType: 'TOWNHOUSE', community: 'Arabian Ranches', buildingOrProject: 'Palmera 2' })).toBe('2-bedroom-townhouse-arabian-ranches');
  });
  it('formats an opaque public id (non-uuid)', () => {
    const id = formatPublicId('A1B2C3D4E5');
    expect(id).toMatch(/^mkz-[a-z0-9]{1,10}$/);
    expect(id).not.toContain('-0000-');
  });
});

describe('marketplace query schema', () => {
  it('coerces + defaults sort/page', () => {
    const q = marketplaceQuerySchema.parse({ type: 'APARTMENT', minPrice: '1000000', maxPrice: '3000000', beds: '2', sort: 'PRICE_ASC', page: '2' });
    expect(q).toMatchObject({ type: 'APARTMENT', minPrice: 1_000_000, maxPrice: 3_000_000, beds: '2', sort: 'PRICE_ASC', page: 2 });
    expect(marketplaceQuerySchema.parse({}).sort).toBe(DEFAULT_SORT);
    expect(marketplaceQuerySchema.parse({}).page).toBe(1);
  });
  it('rejects inverted ranges', () => {
    expect(marketplaceQuerySchema.safeParse({ minPrice: '3000000', maxPrice: '1000000' }).success).toBe(false);
    expect(marketplaceQuerySchema.safeParse({ minSize: '2000', maxSize: '500' }).success).toBe(false);
  });
  it('drops individually-invalid fields but keeps valid ones (lenient parse)', () => {
    const q = parseMarketplaceQuery({ type: 'NOT_A_TYPE', beds: '2', sort: 'bogus', page: 'x' });
    expect(q.type).toBeUndefined();
    expect(q.beds).toBe('2');
    expect(q.sort).toBe(DEFAULT_SORT);
    expect(q.page).toBe(1);
  });
  it('rejects an over-long search string', () => {
    expect(marketplaceQuerySchema.safeParse({ q: 'a'.repeat(101) }).success).toBe(false);
  });
  it('translates the beds filter', () => {
    expect(bedsFilter('studio')).toEqual({ studioOnly: true });
    expect(bedsFilter('3')).toEqual({ min: 3 });
    expect(bedsFilter(undefined)).toBeNull();
  });
  it('paginates with clamping', () => {
    const p = paginate(50, 3, MARKETPLACE_PAGE_SIZE);
    expect(p.totalPages).toBe(3);
    expect(p.page).toBe(3);
    expect(p.hasNext).toBe(false);
    expect(p.hasPrev).toBe(true);
    expect(paginate(0, 1).totalPages).toBe(1);
  });
});
