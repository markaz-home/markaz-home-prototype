import { z } from 'zod';

/**
 * Week-6 Admin capability model (admin-portal-design-spec §5). ONE `ADMIN` account type;
 * capabilities are server-authoritative flags. In the prototype the single Admin holds every
 * capability, but every route and action still checks so the architecture can evolve without
 * redesign. There is no capability-management UI.
 */
export const ADMIN_CAPABILITIES = [
  'VIEW_OVERVIEW',
  'VIEW_CUSTOMERS',
  'MANAGE_CUSTOMER_STATUS',
  'VIEW_LISTINGS',
  'REVIEW_PUBLICATION',
  'MANAGE_LISTING_AVAILABILITY',
  'VIEW_OFFERS',
  'CLOSE_INVALID_OFFER',
  'VIEW_TRANSACTIONS',
  'MANAGE_TRANSACTION_RECOVERY',
  'VIEW_VERIFICATIONS',
  'RETRY_SIMULATION',
  'VIEW_PRIVATE_DOCUMENT_METADATA',
  'ACCESS_PRIVATE_DOCUMENT',
  'VIEW_AUDIT_LOGS',
  'ADD_ADMIN_NOTES',
] as const;
export type AdminCapability = (typeof ADMIN_CAPABILITIES)[number];

/** The prototype's single ADMIN holds all capabilities (§5.1). */
export const PROTOTYPE_ADMIN_CAPABILITIES: readonly AdminCapability[] = ADMIN_CAPABILITIES;

export function hasCapability(caps: readonly AdminCapability[], cap: AdminCapability): boolean {
  return caps.includes(cap);
}

// ---- Restriction (spec §15) -----------------------------------------------
export const CUSTOMER_STATUSES = ['ACTIVE', 'ACTIONS_RESTRICTED'] as const;
export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number];

export const RESTRICT_REASONS = [
  'ACCOUNT_REVIEW',
  'LISTING_INVESTIGATION',
  'OFFER_INVESTIGATION',
  'TRANSACTION_ISSUE',
  'VERIFICATION_ISSUE',
  'OPERATIONAL_FOLLOW_UP',
  'OTHER',
] as const;
export const restrictReasonSchema = z.enum(RESTRICT_REASONS);
export const RESTORE_REASONS = [
  'REVIEW_COMPLETED',
  'ISSUE_RESOLVED',
  'APPLIED_IN_ERROR',
  'OTHER',
] as const;
export const restoreReasonSchema = z.enum(RESTORE_REASONS);

// ---- Admin notes (spec §16) -----------------------------------------------
export const ADMIN_NOTE_CATEGORIES = [
  'REVIEW',
  'CUSTOMER_SUPPORT',
  'LISTING_INVESTIGATION',
  'OFFER_INVESTIGATION',
  'TRANSACTION_ISSUE',
  'VERIFICATION_ISSUE',
  'FOLLOW_UP',
  'CORRECTION',
] as const;
export type AdminNoteCategory = (typeof ADMIN_NOTE_CATEGORIES)[number];
export const adminNoteCategorySchema = z.enum(ADMIN_NOTE_CATEGORIES);
export const adminNoteBodySchema = z.string().trim().min(3).max(1000);

// ---- Reason enums for controlled actions ----------------------------------
export const LISTING_PAUSE_REASONS = [
  'CUSTOMER_REQUEST',
  'INFORMATION_UNDER_REVIEW',
  'VERIFICATION_ISSUE',
  'PUBLICATION_ISSUE',
  'OFFER_OR_TRANSACTION_ISSUE',
  'OPERATIONAL_SAFETY',
] as const;
export const listingPauseReasonSchema = z.enum(LISTING_PAUSE_REASONS);

export const RETURN_FOR_CHANGES_REASONS = [
  'PROPERTY_INFO_INCOMPLETE',
  'PHOTOS_NEED_CHANGES',
  'VERIFICATION_CORRECTION',
  'ASKING_PRICE_REVIEW',
  'PUBLIC_PRIVATE_FIELD_ISSUE',
  'OTHER',
] as const;
export const returnForChangesReasonSchema = z.enum(RETURN_FOR_CHANGES_REASONS);

export const OFFER_CLOSE_REASONS = [
  'LISTING_UNAVAILABLE',
  'PARTICIPANT_MISMATCH',
  'DUPLICATE_ACTIVE_THREAD',
  'INVALID_PROPOSAL_STATE',
  'OPERATIONAL_DATA_REPAIR',
] as const;
export const offerCloseReasonSchema = z.enum(OFFER_CLOSE_REASONS);

export const TRANSACTION_FAIL_REASONS = [
  'UNRECOVERABLE_DATA_INCONSISTENCY',
  'REPEATED_SYSTEM_FAILURE',
  'INVALID_TRANSACTION_RELATIONSHIP',
  'COMPLETION_CONFLICT',
  'OTHER_TECHNICAL',
] as const;
export const transactionFailReasonSchema = z.enum(TRANSACTION_FAIL_REASONS);

export const DOCUMENT_ACCESS_REASONS = [
  'VERIFICATION_REVIEW',
  'LISTING_INVESTIGATION',
  'TRANSACTION_ISSUE',
  'DOCUMENT_PROCESSING_ISSUE',
  'CUSTOMER_SUPPORT_REQUEST',
] as const;
export const documentAccessReasonSchema = z.enum(DOCUMENT_ACCESS_REASONS);

export const CANCELLATION_RESOLUTIONS = ['CONFIRM', 'DECLINE', 'FAIL'] as const;
export const cancellationResolutionSchema = z.enum(CANCELLATION_RESOLUTIONS);

// ---- Audit action names (spec §43.1) --------------------------------------
export const ADMIN_AUDIT_ACTIONS = [
  'ADMIN_CUSTOMER_ACTIONS_RESTRICTED',
  'ADMIN_CUSTOMER_ACTIONS_RESTORED',
  'ADMIN_PUBLICATION_APPROVED_DEMO',
  'ADMIN_PUBLICATION_RETURNED_FOR_CHANGES',
  'ADMIN_PUBLICATION_RETRY_REQUESTED',
  'ADMIN_LISTING_PAUSED',
  'ADMIN_LISTING_RESUMED',
  'ADMIN_PUBLICATION_BLOCKED',
  'ADMIN_VERIFICATION_RETRY_REQUESTED',
  'ADMIN_DOCUMENT_ACCESS_REQUESTED',
  'ADMIN_DOCUMENT_ACCESS_GRANTED',
  'ADMIN_DOCUMENT_ACCESS_FAILED',
  'ADMIN_OFFER_THREAD_CLOSED',
  'ADMIN_TRANSACTION_STEP_RETRY_REQUESTED',
  'ADMIN_TRANSACTION_PAUSED',
  'ADMIN_TRANSACTION_RESUMED',
  'ADMIN_TRANSACTION_MARKED_FAILED',
  'ADMIN_CANCELLATION_CONFLICT_RESOLVED',
  'ADMIN_NOTE_ADDED',
] as const;
export type AdminAuditAction = (typeof ADMIN_AUDIT_ACTIONS)[number];

/** i18n key for a customer's user-facing account status — never expose internal reasons. */
export function customerStatusKey(restricted: boolean): string {
  return restricted ? 'customers.status.restricted' : 'customers.status.active';
}
