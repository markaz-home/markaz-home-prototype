/**
 * Typed channel/table definitions for Supabase Realtime.
 *
 * PRODUCTION RULE (ADR-0005): Supabase Realtime connects DIRECTLY to the RDS
 * endpoint (logical replication). RDS Proxy must NEVER sit in front of Realtime.
 */
export const REALTIME_TABLES = {
  counters: 'realtime_counters',
} as const;

export interface CounterRow {
  id: string;
  value: number;
  updated_at: string;
}

export const DEMO_COUNTER_ID = 'demo';
