import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import {
  asUser,
  cleanup,
  closePool,
  createAuthedPrincipal,
  createLiveListing,
  dbReachable,
  type AuthedPrincipal,
} from './helpers/db';
import { storageEnv } from './helpers/storage';

const env = storageEnv();
const reachable = Boolean(env) && (await dbReachable());
const d = reachable ? describe : describe.skip;
if (!reachable) {
  // eslint-disable-next-line no-console
  console.warn('[realtime-privacy] skipped — local Supabase stack not reachable');
}

type EventRow = {
  id: string;
  thread_id: string;
  event_type: string;
  created_at: string;
  [key: string]: unknown;
};

async function authenticatedClient(principal: AuthedPrincipal): Promise<SupabaseClient> {
  const client = createClient(env!.url, env!.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email: principal.email,
    password: principal.password,
  });
  if (error) throw error;
  if (!data.session) throw new Error('Authenticated Realtime client has no session');
  client.realtime.setAuth(data.session.access_token);
  return client;
}

async function subscribe(
  client: SupabaseClient,
  name: string,
  threadId: string,
  rows: EventRow[],
): Promise<RealtimeChannel> {
  const channel = client.channel(name).on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'offer_events',
      filter: `thread_id=eq.${threadId}`,
    },
    (payload) => rows.push(payload.new as EventRow),
  );

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Realtime subscribe timed out: ${name}`)),
      8_000,
    );
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        clearTimeout(timer);
        resolve();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        clearTimeout(timer);
        reject(new Error(`Realtime subscribe failed: ${name} (${status})`));
      }
    });
  });
  return channel;
}

async function waitForRealtimeReady(client: SupabaseClient, principalId: string): Promise<void> {
  let received = false;
  const name = `rt-warmup-${principalId}`;
  const channel = client.channel(name).on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'realtime_counters',
      filter: 'id=eq.demo',
    },
    () => {
      received = true;
    },
  );

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Realtime readiness subscribe timed out: ${name}`)),
      8_000,
    );
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        clearTimeout(timer);
        resolve();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        clearTimeout(timer);
        reject(new Error(`Realtime readiness subscribe failed: ${name} (${status})`));
      }
    });
  });

  try {
    // On a fresh local/CI stack, Realtime can acknowledge the channel before its
    // Postgres CDC listener has finished warming. Prove an actual database-change
    // round trip before testing the security-sensitive offer stream.
    const deadline = Date.now() + 8_000;
    while (!received && Date.now() < deadline) {
      await asUser(
        principalId,
        (tx) => tx`update public.realtime_counters
                   set value = value + 1, updated_at = now()
                   where id = 'demo'`,
      );
      if (!received) {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
    if (!received) {
      throw new Error('Realtime CDC readiness probe received no update within 8 seconds');
    }
  } finally {
    await client.removeChannel(channel);
  }
}

async function waitForEvent(
  rows: EventRow[],
  eventType: string,
  participant: 'seller' | 'buyer',
): Promise<void> {
  const deadline = Date.now() + 8_000;
  while (!rows.some((row) => row.event_type === eventType) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  if (!rows.some((row) => row.event_type === eventType)) {
    const receivedTypes = rows.map((row) => row.event_type).join(', ') || 'none';
    throw new Error(
      `Realtime ${participant} channel did not receive ${eventType}; received: ${receivedTypes}`,
    );
  }
}

d('Realtime participant isolation (local stack)', () => {
  let seller: AuthedPrincipal;
  let buyer: AuthedPrincipal;
  let outsider: AuthedPrincipal;
  let listing: string;

  beforeAll(async () => {
    const principals = await Promise.all([
      createAuthedPrincipal('rt_seller'),
      createAuthedPrincipal('rt_buyer'),
      createAuthedPrincipal('rt_outsider'),
    ]);
    if (principals.some((principal) => principal === null)) {
      throw new Error('Local Auth environment unavailable');
    }
    [seller, buyer, outsider] = principals as [AuthedPrincipal, AuthedPrincipal, AuthedPrincipal];
    listing = await createLiveListing(seller.id);
  });

  afterAll(async () => {
    await cleanup();
    await closePool();
  });

  it('delivers offer signals only to thread participants and exposes no profile/contact data', async () => {
    const threadId = await asUser(buyer.id, async (tx) => {
      const [thread] =
        await tx`select id from public.create_offer(${listing}::uuid, 2000000, null)`;
      return (thread as { id: string }).id;
    });

    const [sellerClient, buyerClient, outsiderClient] = await Promise.all([
      authenticatedClient(seller),
      authenticatedClient(buyer),
      authenticatedClient(outsider),
    ]);
    const anonymousClient = createClient(env!.url, env!.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    await waitForRealtimeReady(sellerClient, seller.id);

    const sellerRows: EventRow[] = [];
    const buyerRows: EventRow[] = [];
    const outsiderRows: EventRow[] = [];
    const anonymousRows: EventRow[] = [];
    const channels = await Promise.all([
      subscribe(sellerClient, `rt-seller-${threadId}`, threadId, sellerRows),
      subscribe(buyerClient, `rt-buyer-${threadId}`, threadId, buyerRows),
      subscribe(outsiderClient, `rt-outsider-${threadId}`, threadId, outsiderRows),
      subscribe(anonymousClient, `rt-anon-${threadId}`, threadId, anonymousRows),
    ]);

    try {
      const versionRows = (await asUser(
        seller.id,
        (tx) => tx`select version from public.offer_threads where id = ${threadId}`,
      )) as { version: number }[];
      const version = versionRows[0]?.version;
      if (version === undefined) throw new Error('Offer thread version not found');
      await asUser(
        seller.id,
        (tx) => tx`select public.submit_counter(${threadId}::uuid, 2050000, null, ${version})`,
      );

      await Promise.all([
        waitForEvent(sellerRows, 'SELLER_COUNTERED', 'seller'),
        waitForEvent(buyerRows, 'SELLER_COUNTERED', 'buyer'),
      ]);
      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(outsiderRows).toHaveLength(0);
      expect(anonymousRows).toHaveLength(0);

      for (const row of [...sellerRows, ...buyerRows]) {
        expect(row.thread_id).toBe(threadId);
        expect(row).not.toHaveProperty('email');
        expect(row).not.toHaveProperty('phone');
        expect(row).not.toHaveProperty('min_notification_price');
        expect(row).not.toHaveProperty('buyer_user_id');
        expect(row).not.toHaveProperty('seller_user_id');
      }
    } finally {
      await Promise.all([
        ...channels.map((channel, index) =>
          [sellerClient, buyerClient, outsiderClient, anonymousClient][index]!.removeChannel(
            channel,
          ),
        ),
        sellerClient.auth.signOut(),
        buyerClient.auth.signOut(),
        outsiderClient.auth.signOut(),
      ]);
    }
  });
});
