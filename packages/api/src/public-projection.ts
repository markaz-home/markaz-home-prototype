import { bedroomLabel } from '@markaz/domain';

/**
 * Authoritative public listing projection (design spec §37 allowlist). ONE shape
 * for marketplace cards and the public detail page. Built by EXPLICIT allow-list
 * mapping — never by returning a DB row and deleting fields. Anything not listed
 * here is private and must never reach a public response.
 *
 * NEVER public: ownership docs, private storage paths, signed private URLs, draft
 * photos, seller email/phone/name/id, unit identifier, occupancy, verification /
 * Form A / permit internals, publication-request internals, audit, internal UUIDs,
 * private Investment Case inputs (purchase price/date/renovation/total/gain).
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';

/** Public bucket URL for a published photo (the bucket is public — no signing). */
export function publicPhotoUrl(publicPath: string | null | undefined): string | null {
  if (!publicPath) return null;
  return `${SUPABASE_URL}/storage/v1/object/public/listing-photos/${publicPath}`;
}

/** Sentence-case public headline: "2-bedroom apartment in Marina Gate 2". */
export function buildHeadline(input: {
  bedrooms: number | null;
  propertyType: string | null;
  buildingOrProject?: string | null;
  community: string | null;
}): string {
  const beds = bedroomLabel(input.bedrooms);
  const type = input.propertyType ? input.propertyType.toLowerCase() : 'property';
  const place = input.buildingOrProject || input.community || 'the UAE';
  const raw = `${beds} ${type} in ${place}`;
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

const numOr = (v: string | number | null | undefined): number | null =>
  v === null || v === undefined ? null : Number(v);

/** Normalised source row the marketplace queries assemble (public-safe inputs). */
export interface PublicListingRow {
  publicId: string | null;
  publicSlug: string | null;
  state: string;
  askingPrice: string | number | null;
  description: string | null;
  publishedAt: Date | null;
  publicUpdatedAt: Date | null;
  property: {
    propertyType: string | null;
    emirate: string | null;
    community: string | null;
    buildingOrProject: string | null;
    bedrooms: number | null;
    bathrooms: number | null;
    sizeSqft: string | number | null;
    furnishingStatus: string | null;
    completionStatus: string | null;
    parkingSpaces: number | null;
    features: string[] | null;
  } | null;
  coverPublicPath: string | null;
  photoPublicPaths: string[];
  investmentCase: {
    visible: boolean;
    estimatedRoiPct: string | number | null;
    estimatedAnnualisedReturnPct: string | number | null;
    pricePerSqft: string | number | null;
  } | null;
}

/** Compact card shape for the marketplace grid (§23). */
export function toPublicCard(row: PublicListingRow) {
  const p = row.property;
  return {
    publicId: row.publicId,
    slug: row.publicSlug,
    isLive: row.state === 'LIVE',
    headline: buildHeadline({
      bedrooms: p?.bedrooms ?? null,
      propertyType: p?.propertyType ?? null,
      buildingOrProject: p?.buildingOrProject ?? null,
      community: p?.community ?? null,
    }),
    askingPriceAed: numOr(row.askingPrice),
    propertyType: p?.propertyType ?? null,
    emirate: p?.emirate ?? null,
    community: p?.community ?? null,
    bedrooms: p?.bedrooms ?? null,
    bathrooms: p?.bathrooms ?? null,
    sizeSqft: numOr(p?.sizeSqft ?? null),
    coverUrl: publicPhotoUrl(row.coverPublicPath),
    investmentCaseAvailable: row.investmentCase?.visible === true,
  };
}

/** Full public detail shape (§24, §26). */
export function toPublicDetail(row: PublicListingRow) {
  const p = row.property;
  const showIc = row.investmentCase?.visible === true;
  return {
    ...toPublicCard(row),
    description: row.description,
    furnishingStatus: p?.furnishingStatus ?? null,
    completionStatus: p?.completionStatus ?? null,
    parkingSpaces: p?.parkingSpaces ?? null,
    buildingOrProject: p?.buildingOrProject ?? null,
    features: p?.features ?? [],
    photoUrls: row.photoPublicPaths.map(publicPhotoUrl).filter((u): u is string => !!u),
    publishedAt: row.publishedAt?.toISOString() ?? null,
    publicUpdatedAt: row.publicUpdatedAt?.toISOString() ?? null,
    // Public Investment Case METRICS only — never the private inputs (§26.2).
    investmentCase: showIc
      ? {
          estimatedRoiPct: numOr(row.investmentCase!.estimatedRoiPct),
          estimatedAnnualisedReturnPct: numOr(row.investmentCase!.estimatedAnnualisedReturnPct),
          pricePerSqftAed: numOr(row.investmentCase!.pricePerSqft),
        }
      : null,
  };
}

export type PublicCard = ReturnType<typeof toPublicCard>;
export type PublicDetail = ReturnType<typeof toPublicDetail>;
