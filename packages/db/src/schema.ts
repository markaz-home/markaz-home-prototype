import {
  pgEnum,
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  numeric,
  date,
  jsonb,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';

/**
 * Typed mirror of the canonical SQL in supabase/migrations (§6A.4).
 * Drizzle is the typed query layer; the SQL migrations are the source of truth.
 */

// --- Enums -------------------------------------------------------------------
export const accountType = pgEnum('account_type', ['CUSTOMER', 'ADMIN']);
export const identityVerificationStatus = pgEnum('identity_verification_status', [
  'NOT_STARTED',
  'PENDING',
  'VERIFIED_DEMO',
  'FAILED_DEMO',
]);
export const listingState = pgEnum('listing_state', [
  'DRAFT',
  'DETAILS_COMPLETE',
  'DOCUMENT_UPLOADED',
  'OWNERSHIP_REVIEW',
  'OWNERSHIP_VERIFIED',
  'FORM_A_COMPLETE',
  'PHOTOS_COMPLETE',
  'PERMIT_PENDING',
  'READY_TO_PUBLISH',
  'LIVE',
  'PAUSED',
  'REJECTED',
  'SOLD_DEMO',
]);
export const offerState = pgEnum('offer_state', [
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'COUNTERED',
  'ACCEPTED_AS_PREFERRED',
  'REJECTED',
  'EXPIRED',
  'WITHDRAWN',
]);
export const transactionStage = pgEnum('transaction_stage', [
  'OFFER',
  'ACCEPTANCE',
  'MOU',
  'DEPOSIT',
  'NOC',
  'TRANSFER',
  'HANDOVER',
  'COMPLETE_DEMO',
]);
export const verificationStatus = pgEnum('verification_status', [
  'PENDING',
  'VERIFIED_DEMO',
  'FAILED_DEMO',
]);
export const publicationRequestStatus = pgEnum('publication_request_status', [
  'NOT_SUBMITTED',
  'PENDING',
  'APPROVED_DEMO',
  'REJECTED_DEMO',
]);

// --- Profiles ----------------------------------------------------------------
export const profiles = pgTable(
  'profiles',
  {
    id: uuid('id').primaryKey(),
    email: text('email').notNull(),
    fullName: text('full_name'),
    accountType: accountType('account_type').notNull().default('CUSTOMER'),
    identityVerificationStatus: identityVerificationStatus('identity_verification_status')
      .notNull()
      .default('NOT_STARTED'),
    termsAcceptedAt: timestamp('terms_accepted_at', { withTimezone: true }),
    privacyAcceptedAt: timestamp('privacy_accepted_at', { withTimezone: true }),
    onboardingCompletedAt: timestamp('onboarding_completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    emailKey: uniqueIndex('profiles_email_key').on(t.email),
    accountTypeIdx: index('profiles_account_type_idx').on(t.accountType),
  }),
);

// --- Properties / Listings ---------------------------------------------------
export const properties = pgTable(
  'properties',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    emirate: text('emirate').notNull().default('Dubai'),
    community: text('community'),
    addressLine: text('address_line'),
    propertyType: text('property_type'),
    buildingOrProject: text('building_or_project'),
    unitIdentifier: text('unit_identifier'), // PRIVATE (never public)
    bedrooms: integer('bedrooms'),
    bathrooms: integer('bathrooms'),
    sizeSqft: numeric('size_sqft', { precision: 10, scale: 2 }),
    furnishingStatus: text('furnishing_status'),
    occupancyStatus: text('occupancy_status'), // PRIVATE by default
    completionStatus: text('completion_status'),
    parkingSpaces: integer('parking_spaces'),
    features: text('features').array().notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ ownerIdx: index('properties_owner_idx').on(t.ownerId) }),
);

export const listings = pgTable(
  'listings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    propertyId: uuid('property_id').references(() => properties.id, { onDelete: 'set null' }),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    state: listingState('state').notNull().default('DRAFT'),
    currentStep: text('current_step'),
    currency: text('currency').notNull().default('AED'),
    askingPrice: numeric('asking_price', { precision: 14, scale: 2 }),
    minNotificationPrice: numeric('min_notification_price', { precision: 14, scale: 2 }),
    description: text('description'),
    investmentCaseVisible: boolean('investment_case_visible').notNull().default(false),
    investmentCaseSkipped: boolean('investment_case_skipped').notNull().default(false),
    reviewConfirmedAt: timestamp('review_confirmed_at', { withTimezone: true }),
    version: integer('version').notNull().default(1),
    publicId: text('public_id'), // opaque public URL id (≠ uuid)
    publicSlug: text('public_slug'),
    pausedAt: timestamp('paused_at', { withTimezone: true }),
    publicUpdatedAt: timestamp('public_updated_at', { withTimezone: true }),
    publicationVersion: integer('publication_version').notNull().default(1),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    ownerIdx: index('listings_owner_idx').on(t.ownerId),
    stateIdx: index('listings_state_idx').on(t.state),
    publicIdKey: uniqueIndex('listings_public_id_key').on(t.publicId),
  }),
);

export const ownershipDocuments = pgTable('ownership_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  listingId: uuid('listing_id')
    .notNull()
    .references(() => listings.id, { onDelete: 'cascade' }),
  ownerId: uuid('owner_id')
    .notNull()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  documentType: text('document_type').notNull(),
  storagePath: text('storage_path').notNull(),
  originalName: text('original_name'),
  contentType: text('content_type'),
  sizeBytes: integer('size_bytes'),
  active: boolean('active').notNull().default(true),
  status: verificationStatus('status').notNull().default('PENDING'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const verifications = pgTable('verifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  listingId: uuid('listing_id')
    .notNull()
    .references(() => listings.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(),
  status: verificationStatus('status').notNull().default('PENDING'),
  result: jsonb('result').notNull().default({}),
  failureReason: text('failure_reason'),
  supersededAt: timestamp('superseded_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const formARecords = pgTable('form_a_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  listingId: uuid('listing_id')
    .notNull()
    .references(() => listings.id, { onDelete: 'cascade' }),
  status: verificationStatus('status').notNull().default('PENDING'),
  confirmedBy: uuid('confirmed_by').references(() => profiles.id, { onDelete: 'set null' }),
  listingPriceAtConfirmation: numeric('listing_price_at_confirmation', { precision: 14, scale: 2 }),
  signedAt: timestamp('signed_at', { withTimezone: true }),
  supersededAt: timestamp('superseded_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const permitRecords = pgTable('permit_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  listingId: uuid('listing_id')
    .notNull()
    .references(() => listings.id, { onDelete: 'cascade' }),
  permitType: text('permit_type').notNull().default('TRAKHEESI'),
  permitNumber: text('permit_number'),
  status: verificationStatus('status').notNull().default('PENDING'),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  failureReason: text('failure_reason'),
  supersededAt: timestamp('superseded_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const propertyPhotos = pgTable(
  'property_photos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    listingId: uuid('listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    storagePath: text('storage_path').notNull(),
    publicPath: text('public_path'), // opaque path in the public bucket once published
    originalName: text('original_name'),
    contentType: text('content_type'),
    sizeBytes: integer('size_bytes'),
    width: integer('width'),
    height: integer('height'),
    isCover: boolean('is_cover').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    listingOrderIdx: index('property_photos_listing_order_idx').on(t.listingId, t.sortOrder),
  }),
);

export const investmentCases = pgTable('investment_cases', {
  id: uuid('id').primaryKey().defaultRandom(),
  listingId: uuid('listing_id')
    .notNull()
    .unique()
    .references(() => listings.id, { onDelete: 'cascade' }),
  originalPurchasePrice: numeric('original_purchase_price', { precision: 14, scale: 2 }).notNull(),
  purchaseDate: date('purchase_date'),
  renovationCosts: numeric('renovation_costs', { precision: 14, scale: 2 }).notNull().default('0'),
  totalInvested: numeric('total_invested', { precision: 14, scale: 2 }),
  estimatedGain: numeric('estimated_gain', { precision: 14, scale: 2 }),
  estimatedRoiPct: numeric('estimated_roi_pct', { precision: 7, scale: 1 }),
  estimatedAnnualisedReturnPct: numeric('estimated_annualised_return_pct', { precision: 7, scale: 1 }),
  pricePerSqft: numeric('price_per_sqft', { precision: 14, scale: 2 }),
  visible: boolean('visible').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const listingPublicationRequests = pgTable(
  'listing_publication_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    listingId: uuid('listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    sellerUserId: uuid('seller_user_id').references(() => profiles.id, { onDelete: 'set null' }),
    status: publicationRequestStatus('status').notNull().default('NOT_SUBMITTED'),
    outcomeCategory: text('outcome_category'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    supersededAt: timestamp('superseded_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ listingIdx: index('publication_requests_listing_idx').on(t.listingId) }),
);

export const savedProperties = pgTable(
  'saved_properties',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    listingId: uuid('listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ unq: uniqueIndex('saved_properties_unq').on(t.customerId, t.listingId) }),
);

export const savedSearches = pgTable('saved_searches', {
  id: uuid('id').primaryKey().defaultRandom(),
  customerId: uuid('customer_id')
    .notNull()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  label: text('label'),
  query: jsonb('query').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const offers = pgTable(
  'offers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    listingId: uuid('listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
    state: offerState('state').notNull().default('SUBMITTED'),
    belowThreshold: boolean('below_threshold').notNull().default(false),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    listingIdx: index('offers_listing_idx').on(t.listingId),
    createdByIdx: index('offers_created_by_idx').on(t.createdBy),
  }),
);

export const counterOffers = pgTable('counter_offers', {
  id: uuid('id').primaryKey().defaultRandom(),
  offerId: uuid('offer_id')
    .notNull()
    .references(() => offers.id, { onDelete: 'cascade' }),
  createdBy: uuid('created_by')
    .notNull()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const transactions = pgTable(
  'transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    offerId: uuid('offer_id').references(() => offers.id, { onDelete: 'set null' }),
    listingId: uuid('listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    buyerId: uuid('buyer_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    sellerId: uuid('seller_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    stage: transactionStage('stage').notNull().default('ACCEPTANCE'),
    flagged: boolean('flagged').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    buyerIdx: index('transactions_buyer_idx').on(t.buyerId),
    sellerIdx: index('transactions_seller_idx').on(t.sellerId),
  }),
);

export const transactionStageHistory = pgTable('transaction_stage_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  transactionId: uuid('transaction_id')
    .notNull()
    .references(() => transactions.id, { onDelete: 'cascade' }),
  stage: transactionStage('stage').notNull(),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  recipientId: uuid('recipient_id')
    .notNull()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  channel: text('channel').notNull().default('IN_APP'),
  kind: text('kind').notNull(),
  payload: jsonb('payload').notNull().default({}),
  readAt: timestamp('read_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const auditEvents = pgTable('audit_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  actorId: uuid('actor_id').references(() => profiles.id, { onDelete: 'set null' }),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id'),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const schema = {
  profiles,
  properties,
  listings,
  ownershipDocuments,
  verifications,
  formARecords,
  permitRecords,
  propertyPhotos,
  investmentCases,
  listingPublicationRequests,
  savedProperties,
  savedSearches,
  offers,
  counterOffers,
  transactions,
  transactionStageHistory,
  notifications,
  auditEvents,
};

export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
export type Listing = typeof listings.$inferSelect;
export type Offer = typeof offers.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
