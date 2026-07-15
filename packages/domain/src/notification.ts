import { z } from 'zod';

/**
 * In-app notification payload validation (offers-design-spec §30).
 *
 * Notifications are written only by trusted server-side SQL, but read paths still
 * validate `{ kind, payload }` through an explicit **discriminated union** so an
 * unexpected `kind` or a malformed payload can never be forwarded to the client —
 * defence-in-depth on top of the API allow-list projection and recipient-only RLS.
 */
export const OFFER_NOTIFICATION_KINDS = [
  'OFFER_RECEIVED',
  'OFFER_COUNTER_SELLER',
  'OFFER_COUNTER_BUYER',
  'OFFER_ACCEPTED',
  'OFFER_REJECTED',
  'OFFER_WITHDRAWN',
  'OFFER_CLOSED_OTHER',
  'OFFER_LISTING_UNAVAILABLE',
  'OFFER_EXPIRED',
] as const;

export type OfferNotificationKind = (typeof OFFER_NOTIFICATION_KINDS)[number];

/** Week-5 transaction notification kinds (reuse the same canonical table). */
export const TRANSACTION_NOTIFICATION_KINDS = [
  'TRANSACTION_CREATED',
  'TRANSACTION_ACTION_REQUIRED',
  'TRANSACTION_DEPOSIT_CONFIRMED_DEMO',
  'TRANSACTION_TRANSFER_READY',
  'TRANSACTION_COMPLETED_DEMO',
  'TRANSACTION_CANCELLATION_REQUESTED',
  'TRANSACTION_CANCELLED',
  'TRANSACTION_FAILED',
] as const;
export type TransactionNotificationKind = (typeof TRANSACTION_NOTIFICATION_KINDS)[number];

/** Week-6 customer-facing notifications produced by Admin operational actions. */
export const ADMIN_EFFECT_NOTIFICATION_KINDS = [
  'ACCOUNT_ACTIONS_RESTRICTED',
  'ACCOUNT_ACTIONS_RESTORED',
  'LISTING_PAUSED_BY_ADMIN',
  'LISTING_RESUMED_BY_ADMIN',
  'TRANSACTION_MARKED_FAILED',
] as const;
export type AdminEffectNotificationKind = (typeof ADMIN_EFFECT_NOTIFICATION_KINDS)[number];

/** Every offer notification carries only a thread reference (+ optional listing). */
const offerNotificationPayload = z.object({
  threadId: z.string().uuid(),
  listingId: z.string().uuid().optional(),
});

/** Every transaction notification carries only a transaction reference. */
const transactionNotificationPayload = z.object({ transactionId: z.string().uuid() });

/** Discriminated union over `kind`; each variant validates its payload shape. */
export const notificationSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('OFFER_RECEIVED'), payload: offerNotificationPayload }),
  z.object({ kind: z.literal('OFFER_COUNTER_SELLER'), payload: offerNotificationPayload }),
  z.object({ kind: z.literal('OFFER_COUNTER_BUYER'), payload: offerNotificationPayload }),
  z.object({ kind: z.literal('OFFER_ACCEPTED'), payload: offerNotificationPayload }),
  z.object({ kind: z.literal('OFFER_REJECTED'), payload: offerNotificationPayload }),
  z.object({ kind: z.literal('OFFER_WITHDRAWN'), payload: offerNotificationPayload }),
  z.object({ kind: z.literal('OFFER_CLOSED_OTHER'), payload: offerNotificationPayload }),
  z.object({ kind: z.literal('OFFER_LISTING_UNAVAILABLE'), payload: offerNotificationPayload }),
  z.object({ kind: z.literal('OFFER_EXPIRED'), payload: offerNotificationPayload }),
  ...TRANSACTION_NOTIFICATION_KINDS.map((k) =>
    z.object({ kind: z.literal(k), payload: transactionNotificationPayload }),
  ),
  z.object({ kind: z.literal('ACCOUNT_ACTIONS_RESTRICTED'), payload: z.object({}).passthrough() }),
  z.object({ kind: z.literal('ACCOUNT_ACTIONS_RESTORED'), payload: z.object({}).passthrough() }),
  z.object({
    kind: z.literal('LISTING_PAUSED_BY_ADMIN'),
    payload: z.object({ listingId: z.string().uuid() }),
  }),
  z.object({
    kind: z.literal('LISTING_RESUMED_BY_ADMIN'),
    payload: z.object({ listingId: z.string().uuid() }),
  }),
  z.object({
    kind: z.literal('TRANSACTION_MARKED_FAILED'),
    payload: transactionNotificationPayload,
  }),
]);

export type ValidatedNotification = z.infer<typeof notificationSchema>;

export interface SafeNotificationView {
  kind:
    | OfferNotificationKind
    | TransactionNotificationKind
    | AdminEffectNotificationKind
    | 'UNKNOWN';
  threadId: string | null;
  transactionId: string | null;
  listingId: string | null;
}

/**
 * Validate a raw `{ kind, payload }` row and reduce it to the client-safe fields.
 * An unrecognised kind or malformed payload degrades to a safe empty view — never
 * throws, never forwards unexpected data.
 */
export function toSafeNotification(kind: string, payload: unknown): SafeNotificationView {
  const parsed = notificationSchema.safeParse({ kind, payload: payload ?? {} });
  if (!parsed.success)
    return { kind: 'UNKNOWN', threadId: null, transactionId: null, listingId: null };
  const p = parsed.data.payload as {
    threadId?: string;
    transactionId?: string;
    listingId?: string;
  };
  return {
    kind: parsed.data.kind,
    threadId: p.threadId ?? null,
    transactionId: p.transactionId ?? null,
    listingId: p.listingId ?? null,
  };
}
