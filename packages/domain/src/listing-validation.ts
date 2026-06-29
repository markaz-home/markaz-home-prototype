import { z } from 'zod';

/**
 * Shared listing field enums + zod schemas (design spec §12, §15, §16). Used by
 * the client forms, the tRPC procedures, and mirrored by the Drizzle schema.
 * Error messages are stable keys mapped to localized copy in the web app.
 */

// --- Enums (also drive selects + DB check constraints) ----------------------
export const PROPERTY_TYPES = ['APARTMENT', 'VILLA', 'TOWNHOUSE', 'PENTHOUSE'] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

export const FURNISHING_STATUSES = ['UNFURNISHED', 'PARTLY_FURNISHED', 'FURNISHED'] as const;
export type FurnishingStatus = (typeof FURNISHING_STATUSES)[number];

export const OCCUPANCY_STATUSES = ['VACANT', 'OWNER_OCCUPIED', 'TENANT_OCCUPIED'] as const;
export type OccupancyStatus = (typeof OCCUPANCY_STATUSES)[number];

export const COMPLETION_STATUSES = ['READY', 'OFF_PLAN'] as const;
export type CompletionStatus = (typeof COMPLETION_STATUSES)[number];

export const DOCUMENT_TYPES = ['TITLE_DEED', 'OQOOD'] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

/** Curated amenities (design spec §12.5). */
export const AMENITIES = [
  'BALCONY',
  'PRIVATE_GARDEN',
  'PRIVATE_POOL',
  'SHARED_POOL',
  'GYM',
  'CONCIERGE',
  'SECURITY',
  'COVERED_PARKING',
  'BUILT_IN_WARDROBES',
  'WALK_IN_WARDROBE',
  'STUDY',
  'MAIDS_ROOM',
  'STORAGE_ROOM',
  'SEA_VIEW',
  'MARINA_VIEW',
  'CITY_VIEW',
  'COMMUNITY_VIEW',
  'NEAR_PUBLIC_TRANSPORT',
  'PET_FRIENDLY',
] as const;
export type Amenity = (typeof AMENITIES)[number];

export const DESCRIPTION_MIN = 80;
export const DESCRIPTION_MAX = 2000;
export const AMENITIES_MAX = 15;
export const SIZE_MIN_SQFT = 200;
export const SIZE_MAX_SQFT = 50_000;
export const BEDROOMS_MAX = 10;
export const BATHROOMS_MAX = 10;
export const PARKING_MAX = 10;
export const PRICE_MAX_AED = 999_999_999;

// Dubai-only for this milestone (§12.4). Stored, but fixed.
export const SUPPORTED_EMIRATE = 'DUBAI' as const;

// --- Property details (§12.5) -----------------------------------------------
// Building/project is conditionally required for Apartment/Penthouse.
export const propertyDetailsSchema = z
  .object({
    propertyType: z.enum(PROPERTY_TYPES, { errorMap: () => ({ message: 'property_type_required' }) }),
    emirate: z.literal(SUPPORTED_EMIRATE, { errorMap: () => ({ message: 'emirate_unsupported' }) }),
    community: z.string().trim().min(2, 'community_required').max(100, 'community_too_long'),
    buildingOrProject: z.string().trim().max(120, 'building_too_long').optional().or(z.literal('')),
    unitIdentifier: z.string().trim().min(1, 'unit_identifier_required').max(50, 'unit_identifier_too_long'),
    bedrooms: z.number().int('bedrooms_required').min(0, 'bedrooms_required').max(BEDROOMS_MAX, 'bedrooms_invalid'),
    bathrooms: z.number().int('bathrooms_required').min(1, 'bathrooms_required').max(BATHROOMS_MAX, 'bathrooms_invalid'),
    sizeSqft: z
      .number({ invalid_type_error: 'size_invalid' })
      .min(SIZE_MIN_SQFT, 'size_invalid')
      .max(SIZE_MAX_SQFT, 'size_invalid'),
    furnishingStatus: z.enum(FURNISHING_STATUSES, { errorMap: () => ({ message: 'furnishing_required' }) }),
    occupancyStatus: z.enum(OCCUPANCY_STATUSES, { errorMap: () => ({ message: 'occupancy_required' }) }),
    completionStatus: z.enum(COMPLETION_STATUSES, { errorMap: () => ({ message: 'completion_required' }) }),
    parkingSpaces: z.number().int().min(0, 'parking_invalid').max(PARKING_MAX, 'parking_invalid').optional(),
    description: z
      .string()
      .trim()
      .min(DESCRIPTION_MIN, 'description_too_short')
      .max(DESCRIPTION_MAX, 'description_too_long'),
    features: z.array(z.enum(AMENITIES)).max(AMENITIES_MAX, 'amenities_too_many').optional(),
  })
  .refine(
    (d) => {
      const needsBuilding = d.propertyType === 'APARTMENT' || d.propertyType === 'PENTHOUSE';
      return !needsBuilding || (!!d.buildingOrProject && d.buildingOrProject.trim().length > 0);
    },
    { path: ['buildingOrProject'], message: 'building_required' },
  );
export type PropertyDetailsInput = z.infer<typeof propertyDetailsSchema>;

// --- Listing & offer settings (§15) -----------------------------------------
const wholeAed = (maxMsg: string) =>
  z
    .number({ invalid_type_error: 'price_invalid' })
    .int('price_invalid')
    .positive('price_invalid')
    .max(PRICE_MAX_AED, maxMsg);

export const listingSettingsSchema = z
  .object({
    askingPriceAed: wholeAed('asking_price_too_high'),
    minNotificationPriceAed: z
      .number({ invalid_type_error: 'notification_invalid' })
      .int('notification_invalid')
      .positive('notification_invalid')
      .max(PRICE_MAX_AED, 'notification_invalid'),
  })
  .refine((d) => d.minNotificationPriceAed <= d.askingPriceAed, {
    path: ['minNotificationPriceAed'],
    message: 'notification_above_asking',
  });
export type ListingSettingsInput = z.infer<typeof listingSettingsSchema>;

// --- Investment Case (§16) --------------------------------------------------
export const investmentCaseSchema = z
  .object({
    originalPurchasePriceAed: z
      .number({ invalid_type_error: 'price_invalid' })
      .int('price_invalid')
      .positive('price_invalid')
      .max(PRICE_MAX_AED, 'price_invalid'),
    renovationCostsAed: z
      .number({ invalid_type_error: 'renovation_invalid' })
      .int('renovation_invalid')
      .min(0, 'renovation_negative')
      .max(PRICE_MAX_AED, 'renovation_invalid')
      .default(0),
    purchaseDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'purchase_date_required')
      .refine((s) => {
        const t = Date.parse(`${s}T00:00:00Z`);
        return !Number.isNaN(t) && t >= Date.parse('1970-01-01T00:00:00Z');
      }, 'purchase_date_too_early'),
    visible: z.boolean().default(false),
  })
  .refine(
    (d) => Date.parse(`${d.purchaseDate}T00:00:00Z`) <= Date.now(),
    { path: ['purchaseDate'], message: 'purchase_date_future' },
  );
export type InvestmentCaseInput = z.infer<typeof investmentCaseSchema>;

/** Studio is stored as 0 bedrooms; this helps display. */
export function isStudio(bedrooms: number): boolean {
  return bedrooms === 0;
}
