/* eslint-disable no-console */
/**
 * Idempotent demo provisioning (Week 1.5, ADR-0009).
 *
 * Creates the three demo accounts through the SUPPORTED Supabase Admin API
 * (email/password, email pre-confirmed) — NOT by writing Auth tables in SQL —
 * then promotes the admin, marks demo identity verified, and seeds demo domain
 * data via the direct DB connection. Server-only; refuses to run in production.
 *
 * Run AFTER `pnpm supabase:reset`:  pnpm db:setup
 */
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';

for (const p of [resolve(process.cwd(), '../../.env'), resolve(process.cwd(), '.env')]) {
  if (existsSync(p)) config({ path: p });
}

function fail(msg: string): never {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

const demoEnv = (process.env.DEMO_ENVIRONMENT ?? 'local').toLowerCase();
if (demoEnv === 'production' || process.env.NODE_ENV === 'production') {
  fail('Refusing to run demo setup: this is a non-production-only script.');
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DB_URL = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
if (!SUPABASE_URL || !SERVICE_KEY || !DB_URL) {
  fail('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / DATABASE_URL. See .env.example.');
}

interface DemoAccount {
  email: string;
  fullName: string;
  admin: boolean;
  passwordEnv: string;
  defaultPassword: string;
}

const ACCOUNTS: DemoAccount[] = [
  { email: 'customer-a@markaz.demo', fullName: 'Aisha Al Falasi (Demo Seller)', admin: false, passwordEnv: 'DEMO_CUSTOMER_A_PASSWORD', defaultPassword: 'Markaz!Demo1' },
  { email: 'customer-b@markaz.demo', fullName: 'Bilal Haddad (Demo Buyer)', admin: false, passwordEnv: 'DEMO_CUSTOMER_B_PASSWORD', defaultPassword: 'Markaz!Demo1' },
  { email: 'admin@markaz.demo', fullName: 'MARKAZ Operations (Demo Admin)', admin: true, passwordEnv: 'DEMO_ADMIN_PASSWORD', defaultPassword: 'Markaz!Admin1' },
];

const admin = createClient(SUPABASE_URL!, SERVICE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** A labelled SVG placeholder so demo marketplace cards show distinct images
 * without bundling binary fixtures. Uploaded to the PUBLIC listing-photos bucket. */
function svgPlaceholder(label: string, color: string): Buffer {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900">` +
    `<rect width="1200" height="900" fill="${color}"/>` +
    `<text x="600" y="460" font-family="Manrope, sans-serif" font-size="56" fill="#ffffff" text-anchor="middle">${label}</text>` +
    `</svg>`;
  return Buffer.from(svg, 'utf8');
}

async function uploadPublicPhoto(path: string, label: string, color: string): Promise<void> {
  const { error } = await admin.storage
    .from('listing-photos')
    .upload(path, svgPlaceholder(label, color), { contentType: 'image/svg+xml', upsert: true });
  if (error) throw error;
}

/** A real DRAFT object (private bucket) so a seeded READY listing can actually be
 * published through the real photo-copy pipeline in demos/e2e. */
async function uploadDraftPhoto(path: string, label: string, color: string): Promise<void> {
  const { error } = await admin.storage
    .from('listing-photos-draft')
    .upload(path, svgPlaceholder(label, color), { contentType: 'image/svg+xml', upsert: true });
  if (error) throw error;
}

async function findUserIdByEmail(email: string): Promise<string | null> {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (match) return match.id;
    if (data.users.length < 200) break;
  }
  return null;
}

async function ensureUser(acc: DemoAccount): Promise<string> {
  const password = process.env[acc.passwordEnv] ?? acc.defaultPassword;
  const user_metadata = { full_name: acc.fullName, terms_accepted: true, privacy_accepted: true };

  const { data, error } = await admin.auth.admin.createUser({
    email: acc.email,
    password,
    email_confirm: true,
    user_metadata,
  });
  if (data?.user) return data.user.id;

  // Already exists → make idempotent: reset password + metadata, keep confirmed.
  const id = await findUserIdByEmail(acc.email);
  if (!id) throw error ?? new Error(`Could not provision ${acc.email}`);
  const upd = await admin.auth.admin.updateUserById(id, { password, email_confirm: true, user_metadata });
  if (upd.error) throw upd.error;
  return id;
}

async function main() {
  console.log(`→ Provisioning demo accounts via the Supabase Admin API (env: ${demoEnv})`);
  const ids: Record<string, string> = {};
  for (const acc of ACCOUNTS) {
    ids[acc.email] = await ensureUser(acc);
    console.log(`  ✓ ${acc.email}`);
  }
  const idA = ids['customer-a@markaz.demo']!;
  const idB = ids['customer-b@markaz.demo']!;

  const sql = postgres(DB_URL!, { max: 1 });
  try {
    // Upsert each demo profile explicitly (don't rely solely on the signup
    // trigger — Admin-API users created before the table existed would be
    // orphaned). Idempotent; both customers return demo-verified, admin promoted.
    for (const acc of ACCOUNTS) {
      const id = ids[acc.email]!;
      const accountType = acc.admin ? 'ADMIN' : 'CUSTOMER';
      await sql`
        insert into public.profiles
          (id, email, full_name, account_type, identity_verification_status,
           terms_accepted_at, privacy_accepted_at, onboarding_completed_at)
        values (${id}, ${acc.email}, ${acc.fullName}, ${accountType}, 'VERIFIED_DEMO',
                now(), now(), now())
        on conflict (id) do update set
          full_name = excluded.full_name,
          account_type = excluded.account_type,
          identity_verification_status = excluded.identity_verification_status,
          terms_accepted_at = excluded.terms_accepted_at,
          privacy_accepted_at = excluded.privacy_accepted_at,
          onboarding_completed_at = excluded.onboarding_completed_at`;
    }

    // --- Demo domain data (fictional; idempotent via fixed ids) --------------
    await sql`
      insert into public.properties (id, owner_id, emirate, community, address_line, property_type, bedrooms, size_sqft) values
        ('00000000-0000-0000-0000-0000000010a1', ${idA}, 'Dubai', 'Dubai Marina', 'Marina Gate, Tower 1', 'Apartment', 2, 1180.00),
        ('00000000-0000-0000-0000-0000000010a2', ${idA}, 'Dubai', 'Downtown Dubai', 'Burj Vista', 'Apartment', 1, 820.00),
        ('00000000-0000-0000-0000-0000000010a3', ${idA}, 'Dubai', 'Arabian Ranches', 'Palmera 2', 'Villa', 3, 2400.00)
      on conflict (id) do nothing`;

    await sql`
      insert into public.listings (id, property_id, owner_id, title, state, currency, asking_price, min_notification_price, published_at) values
        ('00000000-0000-0000-0000-0000000020a1', '00000000-0000-0000-0000-0000000010a1', ${idA}, 'Bright 2-bed in Dubai Marina (Demo)', 'LIVE', 'AED', 2650000, 2400000, now()),
        ('00000000-0000-0000-0000-0000000020a2', '00000000-0000-0000-0000-0000000010a2', ${idA}, 'Downtown 1-bed with Burj view (Demo)', 'LIVE', 'AED', 1950000, 1800000, now()),
        ('00000000-0000-0000-0000-0000000020a3', '00000000-0000-0000-0000-0000000010a3', ${idA}, 'Arabian Ranches 3-bed villa (Demo)', 'OWNERSHIP_REVIEW', 'AED', 5200000, 4900000, null)
      on conflict (id) do nothing`;

    await sql`
      insert into public.property_photos (id, listing_id, storage_path, is_cover, sort_order) values
        ('00000000-0000-0000-0000-0000000030a1', '00000000-0000-0000-0000-0000000020a1', 'listing-photos/demo/marina-cover.jpg', true, 0),
        ('00000000-0000-0000-0000-0000000030a2', '00000000-0000-0000-0000-0000000020a2', 'listing-photos/demo/downtown-cover.jpg', true, 0)
      on conflict (id) do nothing`;

    await sql`
      insert into public.ownership_documents (id, listing_id, owner_id, document_type, storage_path, status) values
        ('00000000-0000-0000-0000-0000000040a1', '00000000-0000-0000-0000-0000000020a3', ${idA}, 'TITLE_DEED', 'ownership-documents/demo/title-deed-sample.pdf', 'PENDING')
      on conflict (id) do nothing`;

    // Offers: Customer B on Customer A's listings (never on one's own).
    await sql`
      insert into public.offers (id, listing_id, created_by, amount, state, below_threshold, expires_at) values
        ('00000000-0000-0000-0000-0000000050b1', '00000000-0000-0000-0000-0000000020a1', ${idB}, 2500000, 'UNDER_REVIEW', false, now() + interval '48 hours'),
        ('00000000-0000-0000-0000-0000000050b2', '00000000-0000-0000-0000-0000000020a2', ${idB}, 1500000, 'SUBMITTED', true, now() + interval '48 hours')
      on conflict (id) do nothing`;

    await sql`
      insert into public.transactions (id, offer_id, listing_id, buyer_id, seller_id, stage, flagged) values
        ('00000000-0000-0000-0000-0000000060c1', null, '00000000-0000-0000-0000-0000000020a2', ${idB}, ${idA}, 'MOU', false)
      on conflict (id) do nothing`;

    await sql`
      insert into public.transaction_stage_history (transaction_id, stage, note)
      select '00000000-0000-0000-0000-0000000060c1', 'ACCEPTANCE', 'Demo: offer accepted as preferred'
      where not exists (select 1 from public.transaction_stage_history where transaction_id = '00000000-0000-0000-0000-0000000060c1')`;

    await sql`
      insert into public.notifications (recipient_id, channel, kind, payload)
      select ${idA}, 'IN_APP', 'OFFER_RECEIVED', '{"listing":"Dubai Marina"}'::jsonb
      where not exists (select 1 from public.notifications where recipient_id = ${idA} and kind = 'OFFER_RECEIVED')`;

    // --- Week 2 listing-journey draft scenarios (fictional; idempotent) ------
    // Customer A: an incomplete DRAFT, a verification-pending draft, and a
    // READY_TO_PUBLISH listing; Customer B: a separate draft (isolation tests).
    await sql`
      insert into public.properties
        (id, owner_id, emirate, community, building_or_project, unit_identifier, property_type,
         bedrooms, bathrooms, size_sqft, furnishing_status, occupancy_status, completion_status, parking_spaces, features) values
        ('00000000-0000-0000-0000-0000000011a1', ${idA}, 'Dubai', 'Jumeirah Village Circle', null, null, 'APARTMENT',
         1, null, null, null, null, null, null, '{}'),
        ('00000000-0000-0000-0000-0000000011a2', ${idA}, 'Dubai', 'Business Bay', 'Executive Towers', 'Unit 1203', 'APARTMENT',
         2, 2, 1100.00, 'FURNISHED', 'VACANT', 'READY', 1, '{BALCONY,GYM}'),
        ('00000000-0000-0000-0000-0000000011a3', ${idA}, 'Dubai', 'Dubai Marina', 'Marina Gate 2', 'Unit 2205', 'APARTMENT',
         2, 3, 1284.00, 'FURNISHED', 'VACANT', 'READY', 1, '{BALCONY,SEA_VIEW,GYM}'),
        ('00000000-0000-0000-0000-0000000011b1', ${idB}, 'Dubai', 'Dubai Hills Estate', null, null, 'VILLA',
         3, null, null, null, null, null, null, '{}')
      on conflict (id) do nothing`;

    await sql`
      insert into public.listings
        (id, property_id, owner_id, title, state, current_step, currency, asking_price, min_notification_price,
         description, investment_case_visible, investment_case_skipped, review_confirmed_at) values
        ('00000000-0000-0000-0000-0000000021a1', '00000000-0000-0000-0000-0000000011a1', ${idA}, 'Untitled property', 'DRAFT', 'details', 'AED', null, null, null, false, false, null),
        ('00000000-0000-0000-0000-0000000021a2', '00000000-0000-0000-0000-0000000011a2', ${idA}, 'Executive Towers, Unit 1203', 'OWNERSHIP_REVIEW', 'verification', 'AED', null, null,
         'A bright, well-maintained two-bedroom apartment in Business Bay with an open-plan living area, fitted kitchen, built-in wardrobes, and a balcony overlooking the community. Prepared as a fictional sample for this prototype.', false, false, null),
        ('00000000-0000-0000-0000-0000000021a3', '00000000-0000-0000-0000-0000000011a3', ${idA}, 'Marina Gate 2, Unit 2205', 'READY_TO_PUBLISH', 'ready', 'AED', 2100000, 1950000,
         'A furnished two-bedroom apartment in Marina Gate 2 with sea views, an open living and dining area, built-in wardrobes, and a covered parking space. Prepared as a fictional sample listing for this prototype.', true, false, now())
        ,('00000000-0000-0000-0000-0000000021b1', '00000000-0000-0000-0000-0000000011b1', ${idB}, 'Untitled property', 'DRAFT', 'details', 'AED', null, null, null, false, false, null)
      on conflict (id) do nothing`;

    await sql`
      insert into public.ownership_documents (id, listing_id, owner_id, document_type, storage_path, original_name, active, status) values
        ('00000000-0000-0000-0000-0000000041a2', '00000000-0000-0000-0000-0000000021a2', ${idA}, 'TITLE_DEED', 'ownership-documents/demo/fictional-title-deed-1203.pdf', 'Fictional_Title_Deed_1203.pdf', true, 'PENDING'),
        ('00000000-0000-0000-0000-0000000041a3', '00000000-0000-0000-0000-0000000021a3', ${idA}, 'TITLE_DEED', 'ownership-documents/demo/fictional-title-deed-2205.pdf', 'Fictional_Title_Deed_2205.pdf', true, 'VERIFIED_DEMO')
      on conflict (id) do nothing`;
    await sql`
      insert into public.verifications (id, listing_id, kind, status, result) values
        ('00000000-0000-0000-0000-0000000042a2', '00000000-0000-0000-0000-0000000021a2', 'OWNERSHIP', 'PENDING', '{"decided":"SUCCESS"}'::jsonb),
        ('00000000-0000-0000-0000-0000000042a3', '00000000-0000-0000-0000-0000000021a3', 'OWNERSHIP', 'VERIFIED_DEMO', '{"decided":"SUCCESS"}'::jsonb)
      on conflict (id) do nothing`;
    await sql`
      insert into public.form_a_records (id, listing_id, status, confirmed_by, listing_price_at_confirmation, signed_at) values
        ('00000000-0000-0000-0000-0000000043a3', '00000000-0000-0000-0000-0000000021a3', 'VERIFIED_DEMO', ${idA}, 2100000, now())
      on conflict (id) do nothing`;
    await sql`
      insert into public.permit_records (id, listing_id, permit_type, permit_number, status, approved_at) values
        ('00000000-0000-0000-0000-0000000044a3', '00000000-0000-0000-0000-0000000021a3', 'TRAKHEESI', 'DEMO-TRK-00000000', 'VERIFIED_DEMO', now())
      on conflict (id) do nothing`;
    await sql`
      insert into public.property_photos (id, listing_id, storage_path, original_name, is_cover, sort_order) values
        ('00000000-0000-0000-0000-0000000031a3', '00000000-0000-0000-0000-0000000021a3', 'listing-photos-draft/demo/marina-2205-cover.jpg', 'cover.jpg', true, 0),
        ('00000000-0000-0000-0000-0000000031a4', '00000000-0000-0000-0000-0000000021a3', 'listing-photos-draft/demo/marina-2205-living.jpg', 'living.jpg', false, 1)
      on conflict (id) do nothing`;
    await sql`
      insert into public.investment_cases
        (id, listing_id, original_purchase_price, purchase_date, renovation_costs, total_invested, estimated_gain, estimated_roi_pct, estimated_annualised_return_pct, price_per_sqft, visible) values
        ('00000000-0000-0000-0000-0000000045a3', '00000000-0000-0000-0000-0000000021a3', 1750000, '2022-06-29', 50000, 1800000, 300000, 16.7, 3.9, 1636, true)
      on conflict (id) do nothing`;

    // --- Week 3 marketplace scenarios (published LIVE + PAUSED + saves) ------
    // Upload real PUBLIC photo objects so cards/detail render images.
    await uploadPublicPhoto('demo/public/marina-cover.svg', 'Dubai Marina', '#1f4e79');
    await uploadPublicPhoto('demo/public/downtown-cover.svg', 'Downtown Dubai', '#2d6a4f');
    await uploadPublicPhoto('demo/public/jbr-cover.svg', 'Jumeirah Beach Residence', '#7048a3');

    // Enrich the two existing LIVE properties so cards show full facts, and
    // normalise property_type to the canonical uppercase enum so type filters match.
    await sql`
      update public.properties set property_type = 'APARTMENT', bathrooms = 2, furnishing_status = 'FURNISHED', completion_status = 'READY', parking_spaces = 1, building_or_project = 'Marina Gate'
      where id = '00000000-0000-0000-0000-0000000010a1'`;
    await sql`
      update public.properties set property_type = 'APARTMENT', bathrooms = 1, furnishing_status = 'UNFURNISHED', completion_status = 'READY', parking_spaces = 1, building_or_project = 'Burj Vista'
      where id = '00000000-0000-0000-0000-0000000010a2'`;
    await sql`update public.properties set property_type = 'VILLA' where id = '00000000-0000-0000-0000-0000000010a3'`;

    // Give the two existing LIVE listings a publishable public identity + public photos.
    await sql`
      update public.listings set public_id = 'mkz-demomar01', public_slug = '2-bedroom-apartment-in-marina-gate',
        public_updated_at = now(), description = coalesce(description, 'A furnished two-bedroom apartment in Dubai Marina with an open living area and a covered parking space. Fictional sample listing for this prototype.')
      where id = '00000000-0000-0000-0000-0000000020a1'`;
    await sql`
      update public.listings set public_id = 'mkz-demodtn01', public_slug = '1-bedroom-apartment-in-burj-vista',
        public_updated_at = now(), description = coalesce(description, 'A one-bedroom apartment in Downtown Dubai with a Burj Khalifa view. Fictional sample listing for this prototype.')
      where id = '00000000-0000-0000-0000-0000000020a2'`;
    await sql`update public.property_photos set public_path = 'demo/public/marina-cover.svg' where id = '00000000-0000-0000-0000-0000000030a1'`;
    await sql`update public.property_photos set public_path = 'demo/public/downtown-cover.svg' where id = '00000000-0000-0000-0000-0000000030a2'`;

    // Give the Marina LIVE listing (20a1) the full readiness records a published
    // listing has, so pause → resume re-validates the §4.4 gate and succeeds.
    await sql`
      insert into public.ownership_documents (id, listing_id, owner_id, document_type, storage_path, original_name, active, status) values
        ('00000000-0000-0000-0000-0000000040a2', '00000000-0000-0000-0000-0000000020a1', ${idA}, 'TITLE_DEED', 'ownership-documents/demo/fictional-title-marina.pdf', 'Deed_Marina.pdf', true, 'VERIFIED_DEMO')
      on conflict (id) do nothing`;
    await sql`
      insert into public.verifications (id, listing_id, kind, status, result) values
        ('00000000-0000-0000-0000-0000000042a1', '00000000-0000-0000-0000-0000000020a1', 'OWNERSHIP', 'VERIFIED_DEMO', '{"decided":"SUCCESS"}'::jsonb)
      on conflict (id) do nothing`;
    await sql`
      insert into public.form_a_records (id, listing_id, status, confirmed_by, listing_price_at_confirmation, signed_at) values
        ('00000000-0000-0000-0000-0000000043a1', '00000000-0000-0000-0000-0000000020a1', 'VERIFIED_DEMO', ${idA}, 2650000, now())
      on conflict (id) do nothing`;
    await sql`
      insert into public.permit_records (id, listing_id, permit_type, permit_number, status, approved_at) values
        ('00000000-0000-0000-0000-0000000044a1', '00000000-0000-0000-0000-0000000020a1', 'TRAKHEESI', 'DEMO-TRK-000020a1', 'VERIFIED_DEMO', now())
      on conflict (id) do nothing`;

    // A LIVE listing owned by Customer B (so Customer A can save it) + a PAUSED one.
    await sql`
      insert into public.properties
        (id, owner_id, emirate, community, building_or_project, unit_identifier, property_type,
         bedrooms, bathrooms, size_sqft, furnishing_status, occupancy_status, completion_status, parking_spaces, features) values
        ('00000000-0000-0000-0000-0000000011b2', ${idB}, 'Dubai', 'Jumeirah Beach Residence', 'Sadaf 5', 'Unit 1810', 'APARTMENT',
         3, 3, 1850.00, 'FURNISHED', 'VACANT', 'READY', 2, '{BALCONY,SEA_VIEW,GYM,POOL}'),
        ('00000000-0000-0000-0000-0000000011b3', ${idB}, 'Dubai', 'Dubai Hills Estate', 'Golf Place', 'Villa 12', 'VILLA',
         4, 5, 4200.00, 'UNFURNISHED', 'VACANT', 'READY', 2, '{GARDEN,MAIDS_ROOM,GYM}')
      on conflict (id) do nothing`;
    await sql`
      insert into public.listings
        (id, property_id, owner_id, title, state, currency, asking_price, min_notification_price, description,
         investment_case_visible, public_id, public_slug, published_at, public_updated_at, paused_at) values
        ('00000000-0000-0000-0000-0000000020b1', '00000000-0000-0000-0000-0000000011b2', ${idB}, 'JBR 3-bed with sea view (Demo)', 'LIVE', 'AED', 4200000, 3900000,
         'A furnished three-bedroom apartment in Jumeirah Beach Residence with direct sea views, a large balcony, and access to pool and gym. Fictional sample listing for this prototype.',
         true, 'mkz-demojbr01', '3-bedroom-apartment-in-sadaf-5', now(), now(), null),
        ('00000000-0000-0000-0000-0000000020b2', '00000000-0000-0000-0000-0000000011b3', ${idB}, 'Dubai Hills 4-bed villa (Demo)', 'PAUSED', 'AED', 9500000, 9000000,
         'A four-bedroom villa in Dubai Hills Estate backing onto the golf course. Fictional sample listing for this prototype.',
         false, 'mkz-demohill1', '4-bedroom-villa-in-golf-place', now() - interval '3 days', now() - interval '1 day', now() - interval '1 day')
      on conflict (id) do nothing`;
    await sql`
      insert into public.property_photos (id, listing_id, storage_path, public_path, original_name, is_cover, sort_order) values
        ('00000000-0000-0000-0000-0000000030b1', '00000000-0000-0000-0000-0000000020b1', 'listing-photos/demo/jbr-cover.svg', 'demo/public/jbr-cover.svg', 'cover.svg', true, 0)
      on conflict (id) do nothing`;
    await sql`
      insert into public.investment_cases
        (id, listing_id, original_purchase_price, purchase_date, renovation_costs, total_invested, estimated_gain, estimated_roi_pct, estimated_annualised_return_pct, price_per_sqft, visible) values
        ('00000000-0000-0000-0000-0000000045b1', '00000000-0000-0000-0000-0000000020b1', 3600000, '2021-03-15', 120000, 3720000, 480000, 12.9, 2.6, 2270, true)
      on conflict (id) do nothing`;

    // Saved properties for Customer A: one available (B's LIVE) + one unavailable (B's PAUSED).
    await sql`
      insert into public.saved_properties (id, customer_id, listing_id) values
        ('00000000-0000-0000-0000-0000000070a1', ${idA}, '00000000-0000-0000-0000-0000000020b1'),
        ('00000000-0000-0000-0000-0000000070a2', ${idA}, '00000000-0000-0000-0000-0000000020b2')
      on conflict (customer_id, listing_id) do nothing`;

    // --- Week 3 publication e2e fixtures ------------------------------------
    // Make the READY listing (21a3) genuinely publishable: real draft objects at
    // prefix-less paths so the photo-copy pipeline succeeds in the browser flow.
    await uploadDraftPhoto(`${idA}/21a3/cover.svg`, 'Marina Gate 2', '#1f4e79');
    await uploadDraftPhoto(`${idA}/21a3/living.svg`, 'Marina living room', '#27496d');
    await sql`update public.property_photos set storage_path = ${`${idA}/21a3/cover.svg`}, content_type = 'image/svg+xml' where id = '00000000-0000-0000-0000-0000000031a3'`;
    await sql`update public.property_photos set storage_path = ${`${idA}/21a3/living.svg`}, content_type = 'image/svg+xml' where id = '00000000-0000-0000-0000-0000000031a4'`;

    // A second PUBLIC photo for the JBR LIVE listing (gallery keyboard e2e).
    await uploadPublicPhoto('demo/public/jbr-balcony.svg', 'JBR balcony', '#5a3d7a');
    await sql`
      insert into public.property_photos (id, listing_id, storage_path, public_path, original_name, is_cover, sort_order) values
        ('00000000-0000-0000-0000-0000000030b2', '00000000-0000-0000-0000-0000000020b1', 'listing-photos/demo/jbr-balcony.svg', 'demo/public/jbr-balcony.svg', 'balcony.svg', false, 1)
      on conflict (id) do nothing`;

    // Two READY listings owned by Customer A whose publication review was RETURNED
    // (changes required) and PHOTO_PROCESSING_FAILED — for the publication-status e2e.
    await sql`
      insert into public.properties
        (id, owner_id, emirate, community, building_or_project, unit_identifier, property_type,
         bedrooms, bathrooms, size_sqft, furnishing_status, occupancy_status, completion_status, parking_spaces, features) values
        ('00000000-0000-0000-0000-0000000011a4', ${idA}, 'Dubai', 'Jumeirah Village Circle', 'Belgravia', 'Unit 504', 'APARTMENT',
         1, 1, 720.00, 'FURNISHED', 'VACANT', 'READY', 1, '{BALCONY,GYM}'),
        ('00000000-0000-0000-0000-0000000011a5', ${idA}, 'Dubai', 'Business Bay', 'Merano Tower', 'Unit 1102', 'APARTMENT',
         2, 2, 1050.00, 'FURNISHED', 'VACANT', 'READY', 1, '{BALCONY,POOL}')
      on conflict (id) do nothing`;
    await sql`
      insert into public.listings
        (id, property_id, owner_id, title, state, current_step, currency, asking_price, min_notification_price, description, investment_case_visible, investment_case_skipped, review_confirmed_at) values
        ('00000000-0000-0000-0000-0000000021a4', '00000000-0000-0000-0000-0000000011a4', ${idA}, 'Belgravia, Unit 504', 'READY_TO_PUBLISH', 'ready', 'AED', 950000, 880000,
         'A furnished one-bedroom apartment in Jumeirah Village Circle. Fictional sample listing for this prototype.', false, true, now()),
        ('00000000-0000-0000-0000-0000000021a5', '00000000-0000-0000-0000-0000000011a5', ${idA}, 'Merano Tower, Unit 1102', 'READY_TO_PUBLISH', 'ready', 'AED', 1450000, 1350000,
         'A furnished two-bedroom apartment in Business Bay. Fictional sample listing for this prototype.', false, true, now())
      on conflict (id) do nothing`;
    // Prerequisites (ownership/verification/Form A/permit/photos) so the §4.4 gate
    // passes and a retry can succeed. 21a4 gets a REAL draft object (retry → LIVE);
    // 21a5 keeps a metadata-only photo (retry re-fails → photo-failure state).
    await uploadDraftPhoto(`${idA}/21a4/cover.svg`, 'Belgravia', '#3d5a80');
    await sql`
      insert into public.ownership_documents (id, listing_id, owner_id, document_type, storage_path, original_name, active, status) values
        ('00000000-0000-0000-0000-0000000041a4', '00000000-0000-0000-0000-0000000021a4', ${idA}, 'TITLE_DEED', 'ownership-documents/demo/fictional-title-504.pdf', 'Deed_504.pdf', true, 'VERIFIED_DEMO'),
        ('00000000-0000-0000-0000-0000000041a5', '00000000-0000-0000-0000-0000000021a5', ${idA}, 'TITLE_DEED', 'ownership-documents/demo/fictional-title-1102.pdf', 'Deed_1102.pdf', true, 'VERIFIED_DEMO')
      on conflict (id) do nothing`;
    await sql`
      insert into public.verifications (id, listing_id, kind, status, result) values
        ('00000000-0000-0000-0000-0000000042a4', '00000000-0000-0000-0000-0000000021a4', 'OWNERSHIP', 'VERIFIED_DEMO', '{"decided":"SUCCESS"}'::jsonb),
        ('00000000-0000-0000-0000-0000000042a5', '00000000-0000-0000-0000-0000000021a5', 'OWNERSHIP', 'VERIFIED_DEMO', '{"decided":"SUCCESS"}'::jsonb)
      on conflict (id) do nothing`;
    await sql`
      insert into public.form_a_records (id, listing_id, status, confirmed_by, listing_price_at_confirmation, signed_at) values
        ('00000000-0000-0000-0000-0000000043a4', '00000000-0000-0000-0000-0000000021a4', 'VERIFIED_DEMO', ${idA}, 950000, now()),
        ('00000000-0000-0000-0000-0000000043a5', '00000000-0000-0000-0000-0000000021a5', 'VERIFIED_DEMO', ${idA}, 1450000, now())
      on conflict (id) do nothing`;
    await sql`
      insert into public.permit_records (id, listing_id, permit_type, permit_number, status, approved_at) values
        ('00000000-0000-0000-0000-0000000044a4', '00000000-0000-0000-0000-0000000021a4', 'TRAKHEESI', 'DEMO-TRK-000021a4', 'VERIFIED_DEMO', now()),
        ('00000000-0000-0000-0000-0000000044a5', '00000000-0000-0000-0000-0000000021a5', 'TRAKHEESI', 'DEMO-TRK-000021a5', 'VERIFIED_DEMO', now())
      on conflict (id) do nothing`;
    await sql`
      insert into public.property_photos (id, listing_id, storage_path, content_type, original_name, is_cover, sort_order) values
        ('00000000-0000-0000-0000-0000000031a5', '00000000-0000-0000-0000-0000000021a4', ${`${idA}/21a4/cover.svg`}, 'image/svg+xml', 'cover.svg', true, 0),
        ('00000000-0000-0000-0000-0000000031a6', '00000000-0000-0000-0000-0000000021a5', 'demo/missing/cover.jpg', 'image/jpeg', 'cover.jpg', true, 0)
      on conflict (id) do nothing`;
    await sql`
      insert into public.listing_publication_requests (id, listing_id, seller_user_id, status, outcome_category, submitted_at, resolved_at) values
        ('00000000-0000-0000-0000-0000000080a4', '00000000-0000-0000-0000-0000000021a4', ${idA}, 'REJECTED_DEMO', 'DEMO_REVIEW_RETURNED', now() - interval '10 minutes', now() - interval '9 minutes'),
        ('00000000-0000-0000-0000-0000000080a5', '00000000-0000-0000-0000-0000000021a5', ${idA}, 'REJECTED_DEMO', 'PHOTO_PROCESSING_FAILED', now() - interval '10 minutes', now() - interval '9 minutes')
      on conflict (id) do nothing`;

    console.log('  ✓ Demo domain data seeded');
  } finally {
    await sql.end({ timeout: 5 });
  }

  console.log('✓ Demo setup complete. Sign in with the demo credentials (see docs/runbooks/demo-runbook.md).');
}

main().catch((err) => {
  console.error('Demo setup failed:', err);
  process.exit(1);
});
