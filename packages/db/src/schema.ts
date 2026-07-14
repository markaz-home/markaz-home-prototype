import {
  pgEnum,
  pgTable,
  pgView,
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
export const adminNoteCategory = pgEnum('admin_note_category', [
  'REVIEW',
  'CUSTOMER_SUPPORT',
  'LISTING_INVESTIGATION',
  'OFFER_INVESTIGATION',
  'TRANSACTION_ISSUE',
  'VERIFICATION_ISSUE',
  'FOLLOW_UP',
  'CORRECTION',
]);
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
// Week 4 offer negotiation enums (migration 08.4). The Week-1 flat `offer_state`
// enum was retired with the old single-offer tables (ADR-0014).
export const offerThreadStatus = pgEnum('offer_thread_status', [
  'DRAFT',
  'AWAITING_SELLER',
  'AWAITING_BUYER',
  'ACCEPTED',
  'REJECTED',
  'WITHDRAWN',
  'EXPIRED',
  'CLOSED_OTHER_ACCEPTED',
  'CLOSED_LISTING_UNAVAILABLE',
]);
export const offerNextActor = pgEnum('offer_next_actor', ['BUYER', 'SELLER', 'NONE']);
export const offerProposalStatus = pgEnum('offer_proposal_status', [
  'CURRENT',
  'SUPERSEDED',
  'ACCEPTED',
  'REJECTED',
  'EXPIRED',
  'WITHDRAWN',
  'CLOSED',
]);
export const offerSide = pgEnum('offer_side', ['BUYER', 'SELLER']);
export const offerEventType = pgEnum('offer_event_type', [
  'OFFER_SUBMITTED',
  'SELLER_COUNTERED',
  'BUYER_COUNTERED',
  'OFFER_ACCEPTED',
  'OFFER_REJECTED',
  'OFFER_WITHDRAWN',
  'OFFER_EXPIRED',
  'OFFER_VIEWED',
  'LISTING_PAUSED',
  'LISTING_UNAVAILABLE',
  'OTHER_OFFER_ACCEPTED',
]);
// Week-5 canonical transaction model (supersedes the Week-1 placeholder; ADR-0019).
export const transactionStatus = pgEnum('transaction_status', [
  'INITIATED',
  'CONFIRMATION',
  'DEPOSIT',
  'DOCUMENTS',
  'DUE_DILIGENCE',
  'TRANSFER',
  'COMPLETION',
  'COMPLETED_DEMO',
  'CANCELLATION_PENDING',
  'CANCELLED',
  'FAILED',
]);
export const transactionNextActor = pgEnum('transaction_next_actor', ['BUYER', 'SELLER', 'BOTH', 'SYSTEM', 'NONE']);
export const transactionActor = pgEnum('transaction_actor', ['BUYER', 'SELLER', 'BOTH', 'SYSTEM']);
export const transactionTaskStatus = pgEnum('transaction_task_status', [
  'PENDING',
  'ACTION_REQUIRED',
  'IN_PROGRESS',
  'COMPLETED_DEMO',
  'BLOCKED',
  'FAILED',
  'SKIPPED',
]);
export const transactionPurchaseRoute = pgEnum('transaction_purchase_route', ['CASH', 'FINANCING']);
export const transactionFinancingStatus = pgEnum('transaction_financing_status', [
  'NOT_STARTED',
  'IN_PROGRESS',
  'CONFIRMED_DEMO',
  'UNABLE_TO_PROCEED',
]);
export const transactionDocumentStatus = pgEnum('transaction_document_status', [
  'UPLOADED',
  'ACCEPTED_DEMO',
  'NEEDS_REPLACEMENT',
  'REMOVED',
]);
export const transactionEventType = pgEnum('transaction_event_type', [
  'TRANSACTION_CREATED',
  'DETAILS_CONFIRMED',
  'PURCHASE_ROUTE_SELECTED',
  'FINANCING_STATUS_UPDATED',
  'DEMO_DEPOSIT_CONFIRMED',
  'DOCUMENT_UPLOADED',
  'DOCUMENT_REPLACED',
  'DOCUMENT_REMOVED',
  'SUMMARY_REVIEWED',
  'DUE_DILIGENCE_COMPLETED_DEMO',
  'TRANSFER_DATE_PROPOSED',
  'TRANSFER_READINESS_CONFIRMED',
  'TRANSFER_APPOINTMENT_SIMULATED',
  'COMPLETION_CONFIRMED',
  'COMPLETED_DEMO',
  'CANCELLATION_REQUESTED',
  'CANCELLATION_DECLINED',
  'CANCELLED',
  'FAILED',
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
    // Week-6 admin restriction (ACTIVE / ACTIONS_RESTRICTED).
    restrictedAt: timestamp('restricted_at', { withTimezone: true }),
    restrictionReason: text('restriction_reason'),
    restrictedBy: uuid('restricted_by'),
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

// Week 4 offer model (migration 08.4): one thread per (buyer, listing) holding an
// immutable sequence of proposals. All writes go through SECURITY DEFINER SQL
// functions; Drizzle is used for reads + calling those functions.
export const offerThreads = pgTable(
  'offer_threads',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    listingId: uuid('listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    buyerUserId: uuid('buyer_user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    sellerUserId: uuid('seller_user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    status: offerThreadStatus('status').notNull().default('DRAFT'),
    nextActor: offerNextActor('next_actor').notNull().default('BUYER'),
    currentProposalId: uuid('current_proposal_id'),
    acceptedProposalId: uuid('accepted_proposal_id'),
    closedReason: text('closed_reason'),
    rejectReasonCode: text('reject_reason_code'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    buyerSeq: integer('buyer_seq').notNull().default(1),
    listingVersion: integer('listing_version').notNull().default(1),
    publicationVersion: integer('publication_version').notNull().default(1),
    version: integer('version').notNull().default(1),
    lastActivityAt: timestamp('last_activity_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    buyerIdx: index('offer_threads_buyer_idx').on(t.buyerUserId),
    sellerIdx: index('offer_threads_seller_idx').on(t.sellerUserId),
    listingIdx: index('offer_threads_listing_idx').on(t.listingId),
    statusIdx: index('offer_threads_status_idx').on(t.status),
    activityIdx: index('offer_threads_activity_idx').on(t.lastActivityAt),
  }),
);

export const offerProposals = pgTable(
  'offer_proposals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    threadId: uuid('thread_id')
      .notNull()
      .references(() => offerThreads.id, { onDelete: 'cascade' }),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    createdBySide: offerSide('created_by_side').notNull(),
    amountAed: numeric('amount_aed', { precision: 14, scale: 2 }).notNull(),
    status: offerProposalStatus('status').notNull().default('CURRENT'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ threadIdx: index('offer_proposals_thread_idx').on(t.threadId) }),
);

export const offerEvents = pgTable(
  'offer_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    threadId: uuid('thread_id')
      .notNull()
      .references(() => offerThreads.id, { onDelete: 'cascade' }),
    eventType: offerEventType('event_type').notNull(),
    actorSide: offerSide('actor_side'),
    amountAed: numeric('amount_aed', { precision: 14, scale: 2 }),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ threadIdx: index('offer_events_thread_idx').on(t.threadId, t.createdAt) }),
);

export const transactions = pgTable(
  'transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    reference: text('reference').notNull().unique(),
    offerThreadId: uuid('offer_thread_id')
      .notNull()
      .references(() => offerThreads.id, { onDelete: 'cascade' }),
    acceptedProposalId: uuid('accepted_proposal_id')
      .notNull()
      .references(() => offerProposals.id, { onDelete: 'cascade' }),
    listingId: uuid('listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    buyerUserId: uuid('buyer_user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    sellerUserId: uuid('seller_user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    acceptedAmountAed: numeric('accepted_amount_aed', { precision: 14, scale: 2 }).notNull(),
    status: transactionStatus('status').notNull().default('INITIATED'),
    nextActor: transactionNextActor('next_actor').notNull().default('BOTH'),
    purchaseRoute: transactionPurchaseRoute('purchase_route'),
    financingStatus: transactionFinancingStatus('financing_status'),
    depositAmountAed: numeric('deposit_amount_aed', { precision: 14, scale: 2 }),
    depositConfirmedAt: timestamp('deposit_confirmed_at', { withTimezone: true }),
    transferPreferredDate: date('transfer_preferred_date'),
    transferAppointmentAt: timestamp('transfer_appointment_at', { withTimezone: true }),
    cancellationReason: text('cancellation_reason'),
    cancellationRequestedBy: uuid('cancellation_requested_by').references(() => profiles.id, { onDelete: 'set null' }),
    failureCategory: text('failure_category'),
    progressionPausedAt: timestamp('progression_paused_at', { withTimezone: true }),
    progressionPauseReason: text('progression_pause_reason'),
    version: integer('version').notNull().default(1),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    threadIdx: uniqueIndex('uniq_transaction_per_thread').on(t.offerThreadId),
    proposalIdx: uniqueIndex('uniq_transaction_per_proposal').on(t.acceptedProposalId),
    buyerIdx: index('transactions_buyer_idx').on(t.buyerUserId),
    sellerIdx: index('transactions_seller_idx').on(t.sellerUserId),
  }),
);

export const transactionTasks = pgTable(
  'transaction_tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    transactionId: uuid('transaction_id')
      .notNull()
      .references(() => transactions.id, { onDelete: 'cascade' }),
    code: text('code').notNull(),
    stage: transactionStatus('stage').notNull(),
    sequence: integer('sequence').notNull(),
    assignedActor: transactionActor('assigned_actor').notNull(),
    required: boolean('required').notNull().default(true),
    status: transactionTaskStatus('status').notNull().default('PENDING'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    failureCategory: text('failure_category'),
    version: integer('version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ txIdx: index('transaction_tasks_tx_idx').on(t.transactionId, t.sequence) }),
);

export const transactionDocuments = pgTable(
  'transaction_documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    transactionId: uuid('transaction_id')
      .notNull()
      .references(() => transactions.id, { onDelete: 'cascade' }),
    uploadedBy: uuid('uploaded_by')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    documentType: text('document_type').notNull(),
    storagePath: text('storage_path').notNull(),
    fileName: text('file_name').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    status: transactionDocumentStatus('status').notNull().default('UPLOADED'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ txIdx: index('transaction_documents_tx_idx').on(t.transactionId) }),
);

export const transactionEvents = pgTable(
  'transaction_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    transactionId: uuid('transaction_id')
      .notNull()
      .references(() => transactions.id, { onDelete: 'cascade' }),
    eventType: transactionEventType('event_type').notNull(),
    actor: transactionActor('actor'),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ txIdx: index('transaction_events_tx_idx').on(t.transactionId, t.createdAt) }),
);

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

/**
 * Public marketplace view (migration 08.1) — the ONLY public data source. Maps
 * the §37 allowlist for LIVE listings; private columns are absent by construction.
 */
export const marketplaceListings = pgView('marketplace_listings', {
  publicId: text('public_id'),
  publicSlug: text('public_slug'),
  state: text('state'),
  askingPrice: numeric('asking_price', { precision: 14, scale: 2 }),
  description: text('description'),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  publicUpdatedAt: timestamp('public_updated_at', { withTimezone: true }),
  propertyType: text('property_type'),
  emirate: text('emirate'),
  community: text('community'),
  buildingOrProject: text('building_or_project'),
  bedrooms: integer('bedrooms'),
  bathrooms: integer('bathrooms'),
  sizeSqft: numeric('size_sqft', { precision: 10, scale: 2 }),
  furnishingStatus: text('furnishing_status'),
  completionStatus: text('completion_status'),
  parkingSpaces: integer('parking_spaces'),
  features: text('features').array(),
  icVisible: boolean('ic_visible'),
  icRoi: numeric('ic_roi', { precision: 7, scale: 1 }),
  icAnnualised: numeric('ic_annualised', { precision: 7, scale: 1 }),
  icPricePerSqft: numeric('ic_price_per_sqft', { precision: 14, scale: 2 }),
  coverPublicPath: text('cover_public_path'),
  photoPublicPaths: text('photo_public_paths').array(),
}).existing();

// Week-6 admin notes — append-only, admin-only (RLS), per entity.
export const adminNotes = pgTable(
  'admin_notes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    category: adminNoteCategory('category').notNull(),
    body: text('body').notNull(),
    followUpDate: date('follow_up_date'),
    createdByAdminId: uuid('created_by_admin_id').references(() => profiles.id, { onDelete: 'set null' }),
    supersedesNoteId: uuid('supersedes_note_id'),
    hiddenAt: timestamp('hidden_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ entityIdx: index('admin_notes_entity_idx').on(t.entityType, t.entityId, t.createdAt) }),
);

export const schema = {
  profiles,
  adminNotes,
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
  offerThreads,
  offerProposals,
  offerEvents,
  transactions,
  transactionTasks,
  transactionDocuments,
  transactionEvents,
  notifications,
  auditEvents,
};

export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
export type AdminNote = typeof adminNotes.$inferSelect;
export type Listing = typeof listings.$inferSelect;
export type OfferThread = typeof offerThreads.$inferSelect;
export type OfferProposal = typeof offerProposals.$inferSelect;
export type OfferEvent = typeof offerEvents.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type TransactionTask = typeof transactionTasks.$inferSelect;
export type TransactionDocument = typeof transactionDocuments.$inferSelect;
export type TransactionEvent = typeof transactionEvents.$inferSelect;
