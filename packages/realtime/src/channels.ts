/**
 * Typed channel/table definitions for Supabase Realtime.
 *
 * PRODUCTION RULE (ADR-0005): Supabase Realtime connects DIRECTLY to the RDS
 * endpoint (logical replication). RDS Proxy must NEVER sit in front of Realtime.
 */
export const REALTIME_TABLES = {
  counters: 'realtime_counters',
  offerThreads: 'offer_threads',
  offerEvents: 'offer_events',
  transactionEvents: 'transaction_events',
  // Week 6: admin operational queues. RLS scopes delivery to admins (admin RLS).
  publicationRequests: 'listing_publication_requests',
  transactions: 'transactions',
} as const;

/** A row from the transaction_events stream. RLS scopes delivery to participants. */
export interface TransactionEventRow {
  id: string;
  transaction_id: string;
  event_type: string;
  created_at: string;
}

export interface CounterRow {
  id: string;
  value: number;
  updated_at: string;
}

export const DEMO_COUNTER_ID = 'demo';

/** A row from the offer_events stream (negotiation timeline). RLS scopes delivery
 * to thread participants; anonymous subscribers receive nothing (ADR-0018). */
export interface OfferEventRow {
  id: string;
  thread_id: string;
  event_type: string;
  created_at: string;
}
