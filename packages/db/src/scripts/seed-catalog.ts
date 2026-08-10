/* eslint-disable no-console */
/**
 * Explicit hosted-catalog bootstrap for the MARKAZ prototype marketplace.
 *
 * This is intentionally separate from the canonical database seed: customers still
 * sign up through the app, and normal deploys never create marketplace inventory.
 * The script only attaches fictional, clearly labelled demo listings to two existing
 * CUSTOMER accounts. It is idempotent by stable listing/public IDs and refuses to run
 * unless the target Supabase project is named explicitly.
 *
 * Run from the monorepo root:
 *   ALLOW_HOSTED_CATALOG_SEED=YES_I_UNDERSTAND \
 *   CATALOG_TARGET_PROJECT_REF=<project-ref> \
 *   CATALOG_OWNER_EMAIL=<optional-existing-customer> pnpm db:seed:catalog
 */
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';

const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const envFile = resolve(REPO_ROOT, process.env.CATALOG_ENV_FILE ?? '.env');
config({ path: envFile });

type CatalogListing = {
  ownerEmail: 'taniagole@gmail.com' | 'ngole71@gmail.com';
  publicId: string;
  slug: string;
  title: string;
  images: readonly [string, string, string, string, string];
  propertyType: 'APARTMENT' | 'VILLA';
  community: string;
  buildingOrProject: string;
  unitIdentifier: string;
  bedrooms: number;
  bathrooms: number;
  sizeSqft: number;
  furnishing: 'UNFURNISHED' | 'PARTLY_FURNISHED' | 'FURNISHED';
  parkingSpaces: number;
  askingPrice: number;
  minNotificationPrice: number;
  features: string[];
  description: string;
  investmentVisible: boolean;
};

const CATALOG = [
  {
    ownerEmail: 'taniagole@gmail.com',
    publicId: 'MKZ-CATALOG-01',
    slug: 'demo-2-bedroom-apartment-marina-gate-dubai-marina',
    title: '2-bedroom apartment at Marina Gate',
    images: [
      '01-dubai-marina.jpg',
      '01-dubai-marina-02-kitchen.jpg',
      '01-dubai-marina-03-bedroom.jpg',
      '01-dubai-marina-04-bathroom.jpg',
      '01-dubai-marina-05-balcony.jpg',
    ],
    propertyType: 'APARTMENT',
    community: 'Dubai Marina',
    buildingOrProject: 'Marina Gate',
    unitIdentifier: 'DEMO-MG-1204',
    bedrooms: 2,
    bathrooms: 2,
    sizeSqft: 1220,
    furnishing: 'FURNISHED',
    parkingSpaces: 1,
    askingPrice: 2_650_000,
    minNotificationPrice: 2_500_000,
    features: ['BALCONY', 'MARINA_VIEW', 'SHARED_POOL', 'GYM', 'CONCIERGE'],
    description:
      'A bright waterfront apartment with a generous living area, balcony and marina outlook. This is fictional demo inventory for MARKAZ product testing; the unit, availability, price and features are illustrative.',
    investmentVisible: true,
  },
  {
    ownerEmail: 'taniagole@gmail.com',
    publicId: 'MKZ-CATALOG-02',
    slug: 'demo-1-bedroom-apartment-burj-vista-downtown-dubai',
    title: '1-bedroom apartment at Burj Vista',
    images: [
      '02-downtown-dubai.jpg',
      '02-downtown-dubai-02-kitchen.jpg',
      '02-downtown-dubai-03-bedroom.jpg',
      '02-downtown-dubai-04-bathroom.jpg',
      '02-downtown-dubai-05-balcony.jpg',
    ],
    propertyType: 'APARTMENT',
    community: 'Downtown Dubai',
    buildingOrProject: 'Burj Vista',
    unitIdentifier: 'DEMO-BV-1808',
    bedrooms: 1,
    bathrooms: 2,
    sizeSqft: 906,
    furnishing: 'PARTLY_FURNISHED',
    parkingSpaces: 1,
    askingPrice: 2_400_000,
    minNotificationPrice: 2_250_000,
    features: ['BALCONY', 'CITY_VIEW', 'SHARED_POOL', 'GYM', 'NEAR_PUBLIC_TRANSPORT'],
    description:
      'A contemporary Downtown apartment with full-height windows, an efficient layout and skyline views. This is fictional demo inventory for MARKAZ product testing; the unit, availability, price and features are illustrative.',
    investmentVisible: true,
  },
  {
    ownerEmail: 'taniagole@gmail.com',
    publicId: 'MKZ-CATALOG-03',
    slug: 'demo-3-bedroom-apartment-shoreline-palm-jumeirah',
    title: '3-bedroom apartment at Shoreline Residences',
    images: [
      '03-palm-jumeirah.jpg',
      '03-palm-jumeirah-02-kitchen.jpg',
      '03-palm-jumeirah-03-bedroom.jpg',
      '03-palm-jumeirah-04-bathroom.jpg',
      '03-palm-jumeirah-05-terrace.jpg',
    ],
    propertyType: 'APARTMENT',
    community: 'Palm Jumeirah',
    buildingOrProject: 'Shoreline Residences',
    unitIdentifier: 'DEMO-SR-704',
    bedrooms: 3,
    bathrooms: 4,
    sizeSqft: 2150,
    furnishing: 'FURNISHED',
    parkingSpaces: 2,
    askingPrice: 6_750_000,
    minNotificationPrice: 6_400_000,
    features: ['BALCONY', 'SEA_VIEW', 'SHARED_POOL', 'GYM', 'MAIDS_ROOM'],
    description:
      'A spacious beachfront home with an open living room, shaded terrace and wide water outlook. This is fictional demo inventory for MARKAZ product testing; the unit, availability, price and features are illustrative.',
    investmentVisible: false,
  },
  {
    ownerEmail: 'taniagole@gmail.com',
    publicId: 'MKZ-CATALOG-04',
    slug: 'demo-4-bedroom-villa-casa-arabian-ranches',
    title: '4-bedroom villa in Casa',
    images: [
      '04-arabian-ranches.jpg',
      '04-arabian-ranches-02-living.jpg',
      '04-arabian-ranches-03-kitchen.jpg',
      '04-arabian-ranches-04-bedroom.jpg',
      '04-arabian-ranches-05-bathroom.jpg',
    ],
    propertyType: 'VILLA',
    community: 'Arabian Ranches 2',
    buildingOrProject: 'Casa',
    unitIdentifier: 'DEMO-CASA-42',
    bedrooms: 4,
    bathrooms: 5,
    sizeSqft: 3383,
    furnishing: 'UNFURNISHED',
    parkingSpaces: 2,
    askingPrice: 7_400_000,
    minNotificationPrice: 7_000_000,
    features: ['PRIVATE_GARDEN', 'PRIVATE_POOL', 'MAIDS_ROOM', 'STUDY', 'COVERED_PARKING'],
    description:
      'A warm contemporary family villa with a private garden, shaded entertaining area and pool. This is fictional demo inventory for MARKAZ product testing; the unit, availability, price and features are illustrative.',
    investmentVisible: false,
  },
  {
    ownerEmail: 'taniagole@gmail.com',
    publicId: 'MKZ-CATALOG-05',
    slug: 'demo-1-bedroom-apartment-bloom-towers-jvc',
    title: '1-bedroom apartment at Bloom Towers',
    images: [
      '05-jvc.jpg',
      '05-jvc-02-kitchen.jpg',
      '05-jvc-03-bedroom.jpg',
      '05-jvc-04-bathroom.jpg',
      '05-jvc-05-balcony.jpg',
    ],
    propertyType: 'APARTMENT',
    community: 'Jumeirah Village Circle',
    buildingOrProject: 'Bloom Towers',
    unitIdentifier: 'DEMO-BT-908',
    bedrooms: 1,
    bathrooms: 1,
    sizeSqft: 710,
    furnishing: 'FURNISHED',
    parkingSpaces: 1,
    askingPrice: 950_000,
    minNotificationPrice: 900_000,
    features: ['BALCONY', 'COMMUNITY_VIEW', 'SHARED_POOL', 'GYM', 'COVERED_PARKING'],
    description:
      'A practical modern apartment with an open kitchen, balcony and landscaped community outlook. This is fictional demo inventory for MARKAZ product testing; the unit, availability, price and features are illustrative.',
    investmentVisible: true,
  },
  {
    ownerEmail: 'ngole71@gmail.com',
    publicId: 'MKZ-CATALOG-06',
    slug: 'demo-5-bedroom-villa-sector-e-emirates-hills',
    title: '5-bedroom villa in Emirates Hills',
    images: [
      '06-emirates-hills.jpg',
      '06-emirates-hills-02-living.jpg',
      '06-emirates-hills-03-kitchen.jpg',
      '06-emirates-hills-04-bedroom.jpg',
      '06-emirates-hills-05-bathroom.jpg',
    ],
    propertyType: 'VILLA',
    community: 'Emirates Hills',
    buildingOrProject: 'Sector E',
    unitIdentifier: 'DEMO-EH-18',
    bedrooms: 5,
    bathrooms: 7,
    sizeSqft: 11200,
    furnishing: 'PARTLY_FURNISHED',
    parkingSpaces: 4,
    askingPrice: 38_000_000,
    minNotificationPrice: 36_000_000,
    features: ['PRIVATE_GARDEN', 'PRIVATE_POOL', 'COMMUNITY_VIEW', 'MAIDS_ROOM', 'STUDY'],
    description:
      'A substantial golf-community villa with expansive reception rooms, landscaped grounds and pool. This is fictional demo inventory for MARKAZ product testing; the home, availability, price and features are illustrative.',
    investmentVisible: false,
  },
  {
    ownerEmail: 'ngole71@gmail.com',
    publicId: 'MKZ-CATALOG-07',
    slug: 'demo-3-bedroom-villa-sidra-2-dubai-hills',
    title: '3-bedroom villa in Sidra 2',
    images: [
      '07-dubai-hills.jpg',
      '07-dubai-hills-02-living.jpg',
      '07-dubai-hills-03-kitchen.jpg',
      '07-dubai-hills-04-bedroom.jpg',
      '07-dubai-hills-05-study.jpg',
    ],
    propertyType: 'VILLA',
    community: 'Dubai Hills Estate',
    buildingOrProject: 'Sidra 2',
    unitIdentifier: 'DEMO-SIDRA-117',
    bedrooms: 3,
    bathrooms: 4,
    sizeSqft: 3102,
    furnishing: 'UNFURNISHED',
    parkingSpaces: 2,
    askingPrice: 6_100_000,
    minNotificationPrice: 5_800_000,
    features: ['PRIVATE_GARDEN', 'MAIDS_ROOM', 'COVERED_PARKING', 'COMMUNITY_VIEW', 'PET_FRIENDLY'],
    description:
      'A modern family villa with a bright open plan, private garden and convenient community setting. This is fictional demo inventory for MARKAZ product testing; the home, availability, price and features are illustrative.',
    investmentVisible: true,
  },
  {
    ownerEmail: 'ngole71@gmail.com',
    publicId: 'MKZ-CATALOG-08',
    slug: 'demo-2-bedroom-apartment-sadaf-7-jbr',
    title: '2-bedroom apartment at Sadaf 7',
    images: [
      '08-jbr.jpg',
      '08-jbr-02-kitchen.jpg',
      '08-jbr-03-bedroom.jpg',
      '08-jbr-04-bathroom.jpg',
      '08-jbr-05-balcony.jpg',
    ],
    propertyType: 'APARTMENT',
    community: 'Jumeirah Beach Residence',
    buildingOrProject: 'Sadaf 7',
    unitIdentifier: 'DEMO-S7-1506',
    bedrooms: 2,
    bathrooms: 3,
    sizeSqft: 1466,
    furnishing: 'FURNISHED',
    parkingSpaces: 1,
    askingPrice: 2_850_000,
    minNotificationPrice: 2_700_000,
    features: ['BALCONY', 'SEA_VIEW', 'SHARED_POOL', 'GYM', 'NEAR_PUBLIC_TRANSPORT'],
    description:
      'A generous beachfront apartment with an airy living room, balcony and coastal city outlook. This is fictional demo inventory for MARKAZ product testing; the unit, availability, price and features are illustrative.',
    investmentVisible: true,
  },
  {
    ownerEmail: 'ngole71@gmail.com',
    publicId: 'MKZ-CATALOG-09',
    slug: 'demo-1-bedroom-apartment-the-opus-business-bay',
    title: '1-bedroom apartment at The Opus',
    images: [
      '09-business-bay.jpg',
      '09-business-bay-02-kitchen.jpg',
      '09-business-bay-03-bedroom.jpg',
      '09-business-bay-04-bathroom.jpg',
      '09-business-bay-05-balcony.jpg',
    ],
    propertyType: 'APARTMENT',
    community: 'Business Bay',
    buildingOrProject: 'The Opus',
    unitIdentifier: 'DEMO-OPUS-1103',
    bedrooms: 1,
    bathrooms: 2,
    sizeSqft: 1040,
    furnishing: 'FURNISHED',
    parkingSpaces: 1,
    askingPrice: 2_300_000,
    minNotificationPrice: 2_175_000,
    features: ['CITY_VIEW', 'SHARED_POOL', 'GYM', 'CONCIERGE', 'NEAR_PUBLIC_TRANSPORT'],
    description:
      'A design-led urban apartment with a sculptural interior, canal outlook and central location. This is fictional demo inventory for MARKAZ product testing; the unit, availability, price and features are illustrative.',
    investmentVisible: true,
  },
  {
    ownerEmail: 'ngole71@gmail.com',
    publicId: 'MKZ-CATALOG-10',
    slug: 'demo-3-bedroom-villa-springs-14',
    title: '3-bedroom villa in The Springs',
    images: [
      '10-the-springs.jpg',
      '10-the-springs-02-living.jpg',
      '10-the-springs-03-kitchen.jpg',
      '10-the-springs-04-bedroom.jpg',
      '10-the-springs-05-study.jpg',
    ],
    propertyType: 'VILLA',
    community: 'The Springs',
    buildingOrProject: 'Springs 14',
    unitIdentifier: 'DEMO-SP14-63',
    bedrooms: 3,
    bathrooms: 3,
    sizeSqft: 2550,
    furnishing: 'UNFURNISHED',
    parkingSpaces: 2,
    askingPrice: 4_900_000,
    minNotificationPrice: 4_650_000,
    features: ['PRIVATE_GARDEN', 'COMMUNITY_VIEW', 'STUDY', 'COVERED_PARKING', 'PET_FRIENDLY'],
    description:
      'A renovated lake-community villa with a shaded patio, private garden and flexible family space. This is fictional demo inventory for MARKAZ product testing; the home, availability, price and features are illustrative.',
    investmentVisible: false,
  },
] satisfies readonly CatalogListing[];

function fail(message: string): never {
  throw new Error(message);
}

function stableUuid(key: string): string {
  const hex = createHash('sha256').update(`markaz-catalog-v1:${key}`).digest('hex').slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20)}`;
}

function assertHostedTarget(supabaseUrl: string, dbUrl: string): void {
  if (process.env.ALLOW_HOSTED_CATALOG_SEED !== 'YES_I_UNDERSTAND') {
    fail('Refusing hosted catalog seed: set ALLOW_HOSTED_CATALOG_SEED=YES_I_UNDERSTAND.');
  }
  const expectedRef = process.env.CATALOG_TARGET_PROJECT_REF;
  if (!expectedRef) fail('CATALOG_TARGET_PROJECT_REF is required.');

  const supabase = new URL(supabaseUrl);
  const database = new URL(dbUrl);
  const loopback = new Set(['127.0.0.1', 'localhost', '::1']);
  if (loopback.has(supabase.hostname) || loopback.has(database.hostname)) {
    fail(
      'This command is for the explicitly named hosted catalog only; a loopback target was supplied.',
    );
  }
  if (supabase.hostname !== `${expectedRef}.supabase.co`) {
    fail(`Supabase URL does not match CATALOG_TARGET_PROJECT_REF (${expectedRef}).`);
  }
  if (!database.hostname.includes(expectedRef) && !database.username.includes(expectedRef)) {
    fail(`Database URL does not match CATALOG_TARGET_PROJECT_REF (${expectedRef}).`);
  }
}

async function main(): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const dbUrl = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!supabaseUrl || !serviceKey || !dbUrl) {
    fail('Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or database URL.');
  }
  assertHostedTarget(supabaseUrl, dbUrl);

  const storage = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const sql = postgres(dbUrl, { max: 1, prepare: false, idle_timeout: 10 });
  const created: string[] = [];
  const repaired: string[] = [];

  try {
    const requestedOwnerEmail = process.env.CATALOG_OWNER_EMAIL?.trim().toLowerCase();
    const supportedOwnerEmails = [...new Set<string>(CATALOG.map((item) => item.ownerEmail))];
    if (requestedOwnerEmail && !supportedOwnerEmails.includes(requestedOwnerEmail)) {
      fail(`CATALOG_OWNER_EMAIL is not present in the approved catalog: ${requestedOwnerEmail}`);
    }
    const catalog = requestedOwnerEmail
      ? CATALOG.filter((item) => item.ownerEmail === requestedOwnerEmail)
      : CATALOG;
    const requiredOwnerEmails = [...new Set(catalog.map((item) => item.ownerEmail))];

    const owners = await sql<{ id: string; email: string; account_type: string }[]>`
      select id::text, lower(email) as email, account_type::text as account_type
      from public.profiles
      where lower(email) in ${sql(requiredOwnerEmails)}`;
    const ownerByEmail = new Map(owners.map((owner) => [owner.email, owner]));
    for (const email of requiredOwnerEmails) {
      const owner = ownerByEmail.get(email);
      if (!owner) fail(`Required existing customer was not found: ${email}`);
      if (owner.account_type !== 'CUSTOMER') fail(`Listing owner is not a CUSTOMER: ${email}`);
    }

    for (let index = 0; index < catalog.length; index += 1) {
      const item = catalog[index]!;
      const owner = ownerByEmail.get(item.ownerEmail)!;
      const listingId = stableUuid(`${item.publicId}:listing`);
      const propertyId = stableUuid(`${item.publicId}:property`);
      const ownershipId = stableUuid(`${item.publicId}:ownership`);
      const verificationId = stableUuid(`${item.publicId}:verification`);
      const formAId = stableUuid(`${item.publicId}:form-a`);
      const permitId = stableUuid(`${item.publicId}:permit`);
      const publicationId = stableUuid(`${item.publicId}:publication`);
      const investmentId = stableUuid(`${item.publicId}:investment`);
      const documentPath = `${owner.id}/${listingId}/catalog-title-deed.pdf`;
      const photos = await Promise.all(
        item.images.map(async (imageName, photoIndex) => {
          const photoId =
            photoIndex === 0
              ? stableUuid(`${item.publicId}:photo`)
              : stableUuid(`${item.publicId}:photo:${photoIndex}`);
          const publicPath = `${item.publicId}/${photoId}`;
          const draftPath = `${owner.id}/${listingId}/${
            photoIndex === 0 ? 'catalog-cover.jpg' : `catalog-gallery-${photoIndex}.jpg`
          }`;
          const imagePath = resolve(REPO_ROOT, 'scripts/fixtures/markaz-catalog/images', imageName);
          const [image, imageInfo] = await Promise.all([readFile(imagePath), stat(imagePath)]);
          return { photoId, publicPath, draftPath, imageName, image, imageInfo, photoIndex };
        }),
      );
      const demoPdf = Buffer.from(
        `%PDF-1.4\n% MARKAZ fictional catalog document — ${item.publicId}\n%%EOF\n`,
      );

      const existing = await sql<{ id: string; owner_email: string }[]>`
        select l.id::text, lower(p.email) as owner_email
        from public.listings l
        join public.profiles p on p.id = l.owner_id
        where l.public_id = ${item.publicId}
        limit 1`;
      if (existing[0] && existing[0].owner_email !== item.ownerEmail) {
        fail(`${item.publicId} already exists under a different owner.`);
      }

      const uploaded: Array<{ bucket: string; path: string }> = [];
      const upload = async (
        bucket: string,
        path: string,
        body: Buffer,
        contentType: string,
      ): Promise<void> => {
        const { error } = await storage.storage.from(bucket).upload(path, body, {
          contentType,
          cacheControl: bucket === 'listing-photos' ? '31536000' : '3600',
          upsert: true,
        });
        if (error) throw new Error(`Storage upload failed for ${bucket}/${path}: ${error.message}`);
        uploaded.push({ bucket, path });
      };

      for (const photo of photos) {
        await upload('listing-photos', photo.publicPath, photo.image, 'image/jpeg');
        await upload('listing-photos-draft', photo.draftPath, photo.image, 'image/jpeg');
      }
      await upload('ownership-documents', documentPath, demoPdf, 'application/pdf');

      try {
        await sql.begin(async (tx) => {
          await tx`
            insert into public.properties
              (id, owner_id, emirate, community, address_line, property_type,
               bedrooms, size_sqft, building_or_project, unit_identifier, bathrooms,
               furnishing_status, occupancy_status, completion_status, parking_spaces, features)
            values
              (${propertyId}::uuid, ${owner.id}::uuid, 'DUBAI', ${item.community},
               ${`${item.community}, Dubai`}, ${item.propertyType}, ${item.bedrooms},
               ${item.sizeSqft}, ${item.buildingOrProject}, ${item.unitIdentifier},
               ${item.bathrooms}, ${item.furnishing}, 'VACANT', 'READY',
               ${item.parkingSpaces}, ${item.features}::text[])
            on conflict (id) do update set
              owner_id = excluded.owner_id,
              emirate = excluded.emirate,
              community = excluded.community,
              address_line = excluded.address_line,
              property_type = excluded.property_type,
              bedrooms = excluded.bedrooms,
              size_sqft = excluded.size_sqft,
              building_or_project = excluded.building_or_project,
              unit_identifier = excluded.unit_identifier,
              bathrooms = excluded.bathrooms,
              furnishing_status = excluded.furnishing_status,
              occupancy_status = excluded.occupancy_status,
              completion_status = excluded.completion_status,
              parking_spaces = excluded.parking_spaces,
              features = excluded.features`;

          const publishedAt = new Date(Date.now() - index * 6 * 60 * 60 * 1000);
          await tx`
            insert into public.listings
              (id, property_id, owner_id, title, state, currency, asking_price,
               min_notification_price, published_at, current_step, description,
               investment_case_visible, investment_case_skipped, review_confirmed_at,
               version, public_id, public_slug, public_updated_at, publication_version)
            values
              (${listingId}::uuid, ${propertyId}::uuid, ${owner.id}::uuid, ${item.title},
               'LIVE', 'AED', ${item.askingPrice}, ${item.minNotificationPrice},
               ${publishedAt}, 'ready', ${item.description}, ${item.investmentVisible},
               ${!item.investmentVisible}, ${publishedAt}, 1, ${item.publicId},
               ${item.slug}, ${publishedAt}, 2)
            on conflict (id) do update set
              property_id = excluded.property_id,
              owner_id = excluded.owner_id,
              title = excluded.title,
              state = 'LIVE',
              asking_price = excluded.asking_price,
              min_notification_price = excluded.min_notification_price,
              description = excluded.description,
              investment_case_visible = excluded.investment_case_visible,
              investment_case_skipped = excluded.investment_case_skipped,
              public_id = excluded.public_id,
              public_slug = excluded.public_slug,
              public_updated_at = now(),
              paused_at = null`;

          await tx`
            insert into public.ownership_documents
              (id, listing_id, owner_id, document_type, storage_path, status, original_name,
               content_type, size_bytes, active)
            values
              (${ownershipId}::uuid, ${listingId}::uuid, ${owner.id}::uuid, 'TITLE_DEED',
               ${documentPath}, 'VERIFIED_DEMO', 'fictional-catalog-title-deed.pdf',
               'application/pdf', ${demoPdf.byteLength}, true)
            on conflict (id) do update set
              storage_path = excluded.storage_path,
              status = 'VERIFIED_DEMO',
              active = true`;

          await tx`
            insert into public.verifications (id, listing_id, kind, status, result)
            values (${verificationId}::uuid, ${listingId}::uuid, 'OWNERSHIP', 'VERIFIED_DEMO',
                    ${JSON.stringify({ source: 'MARKAZ_CATALOG_BOOTSTRAP', simulated: true })}::jsonb)
            on conflict (id) do update set
              status = 'VERIFIED_DEMO',
              result = excluded.result,
              superseded_at = null`;

          await tx`
            insert into public.form_a_records
              (id, listing_id, status, signed_at, confirmed_by, listing_price_at_confirmation)
            values (${formAId}::uuid, ${listingId}::uuid, 'VERIFIED_DEMO', now(),
                    ${owner.id}::uuid, ${item.askingPrice})
            on conflict (id) do update set
              status = 'VERIFIED_DEMO',
              signed_at = excluded.signed_at,
              confirmed_by = excluded.confirmed_by,
              listing_price_at_confirmation = excluded.listing_price_at_confirmation,
              superseded_at = null`;

          await tx`
            insert into public.permit_records
              (id, listing_id, permit_type, permit_number, status, approved_at)
            values (${permitId}::uuid, ${listingId}::uuid, 'TRAKHEESI',
                    ${`DEMO-TRK-CAT-${String(index + 1).padStart(2, '0')}`},
                    'VERIFIED_DEMO', now())
            on conflict (id) do update set
              status = 'VERIFIED_DEMO',
              permit_number = excluded.permit_number,
              approved_at = excluded.approved_at,
              superseded_at = null`;

          for (const photo of photos) {
            await tx`
              insert into public.property_photos
                (id, listing_id, storage_path, is_cover, sort_order, original_name,
                 content_type, size_bytes, width, height, public_path)
              values (${photo.photoId}::uuid, ${listingId}::uuid, ${photo.draftPath},
                      ${photo.photoIndex === 0}, ${photo.photoIndex}, ${photo.imageName},
                      'image/jpeg', ${photo.imageInfo.size}, 1448, 1086, ${photo.publicPath})
              on conflict (id) do update set
                storage_path = excluded.storage_path,
                is_cover = excluded.is_cover,
                sort_order = excluded.sort_order,
                original_name = excluded.original_name,
                content_type = excluded.content_type,
                size_bytes = excluded.size_bytes,
                width = excluded.width,
                height = excluded.height,
                public_path = excluded.public_path`;
          }

          const originalPurchasePrice = Math.round(item.askingPrice * 0.78);
          const renovationCosts = Math.round(item.askingPrice * 0.02);
          const totalInvested = originalPurchasePrice + renovationCosts;
          const estimatedGain = item.askingPrice - totalInvested;
          const estimatedRoi = Number(((estimatedGain / totalInvested) * 100).toFixed(1));
          const annualised = Number((estimatedRoi / 3).toFixed(1));
          const pricePerSqft = Number((item.askingPrice / item.sizeSqft).toFixed(2));
          await tx`
            insert into public.investment_cases
              (id, listing_id, original_purchase_price, purchase_date, renovation_costs,
               total_invested, estimated_gain, estimated_roi_pct,
               estimated_annualised_return_pct, price_per_sqft, visible)
            values (${investmentId}::uuid, ${listingId}::uuid, ${originalPurchasePrice},
                    '2023-01-15'::date, ${renovationCosts}, ${totalInvested}, ${estimatedGain},
                    ${estimatedRoi}, ${annualised}, ${pricePerSqft}, ${item.investmentVisible})
            on conflict (id) do update set
              original_purchase_price = excluded.original_purchase_price,
              renovation_costs = excluded.renovation_costs,
              total_invested = excluded.total_invested,
              estimated_gain = excluded.estimated_gain,
              estimated_roi_pct = excluded.estimated_roi_pct,
              estimated_annualised_return_pct = excluded.estimated_annualised_return_pct,
              price_per_sqft = excluded.price_per_sqft,
              visible = excluded.visible`;

          await tx`
            insert into public.listing_publication_requests
              (id, listing_id, seller_user_id, status, submitted_at, resolved_at)
            values (${publicationId}::uuid, ${listingId}::uuid, ${owner.id}::uuid,
                    'APPROVED_DEMO', ${publishedAt}, ${publishedAt})
            on conflict (id) do update set
              seller_user_id = excluded.seller_user_id,
              status = 'APPROVED_DEMO',
              outcome_category = null,
              resolved_at = excluded.resolved_at,
              superseded_at = null`;

          for (const photo of photos) {
            await tx`
              update storage.objects
              set owner = ${owner.id}::uuid
              where bucket_id = 'listing-photos-draft' and name = ${photo.draftPath}`;
          }
          await tx`
            update storage.objects
            set owner = ${owner.id}::uuid
            where bucket_id = 'ownership-documents' and name = ${documentPath}`;

          for (const action of [
            'LISTING_PUBLICATION_SUBMITTED',
            'LISTING_PUBLIC_PHOTOS_PREPARED',
            'LISTING_PUBLICATION_APPROVED_DEMO',
            'LISTING_PUBLISHED',
          ]) {
            const auditId = stableUuid(`${item.publicId}:audit:${action}`);
            await tx`
              insert into public.audit_events
                (id, actor_id, action, entity_type, entity_id, metadata, created_at)
              values (${auditId}::uuid, ${owner.id}::uuid, ${action}, 'listing',
                      ${listingId}::uuid,
                      ${JSON.stringify({ source: 'MARKAZ_CATALOG_BOOTSTRAP', simulated: true })}::jsonb,
                      ${publishedAt})
              on conflict (id) do nothing`;
          }
        });
      } catch (error) {
        if (!existing[0]) {
          await Promise.all(
            uploaded.map(({ bucket, path }) =>
              storage.storage
                .from(bucket)
                .remove([path])
                .then(() => undefined),
            ),
          );
        }
        throw error;
      }

      if (existing[0]) repaired.push(item.publicId);
      else created.push(item.publicId);
      console.log(`✓ ${item.publicId} · ${item.community} · ${item.ownerEmail}`);
    }

    const rows = await sql<
      { owner_email: string; listing_count: number; photo_count: number; approved_count: number }[]
    >`
      select lower(p.email) as owner_email,
             count(distinct l.id)::int as listing_count,
             count(distinct ph.id)::int as photo_count,
             count(distinct pr.id) filter (where pr.status = 'APPROVED_DEMO')::int as approved_count
      from public.listings l
      join public.profiles p on p.id = l.owner_id
      left join public.property_photos ph on ph.listing_id = l.id and ph.public_path is not null
      left join public.listing_publication_requests pr on pr.listing_id = l.id and pr.superseded_at is null
      where l.public_id like 'MKZ-CATALOG-%'
        and l.state = 'LIVE'
        and lower(p.email) in ${sql(requiredOwnerEmails)}
      group by p.email
      order by p.email`;
    console.log(`Catalog complete: ${created.length} created, ${repaired.length} refreshed.`);
    console.table(rows);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error: unknown) => {
  console.error('Hosted catalog bootstrap failed:', error);
  process.exit(1);
});
