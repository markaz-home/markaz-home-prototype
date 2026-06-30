import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { sql } from 'drizzle-orm';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { withUserContext, closeConnections } from '@markaz/db';
import { getAppDb, resolveDemoIds, LISTING_IDS, type DemoIds } from './helpers';

/**
 * Week 3 closure — direct DATABASE and STORAGE boundary proofs. These bypass tRPC
 * and exercise the real RLS / trigger / storage policies (migration 08.3).
 * Requires the live stack + demo seed (`pnpm supabase:reset && pnpm db:setup`).
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEMO_PASSWORD = process.env.DEMO_CUSTOMER_A_PASSWORD ?? 'Markaz!Demo1';

// Fixed demo listing ids (setup-demo.ts).
const L = {
  aLive: '00000000-0000-0000-0000-0000000020a1',
  bLive: '00000000-0000-0000-0000-0000000020b1',
  bPaused: '00000000-0000-0000-0000-0000000020b2',
  bDraft: '00000000-0000-0000-0000-0000000021b1',
  aReady: LISTING_IDS.readyToPublish,
} as const;

let ids: DemoIds | null = null;
beforeAll(async () => {
  ids = await resolveDemoIds();
  if (!ids) console.warn('[publication-security] Skipped — run `pnpm db:setup`.');
});
afterAll(async () => {
  await closeConnections();
});

const asA = <T>(fn: Parameters<typeof withUserContext>[2]) =>
  withUserContext(getAppDb(), { userId: ids!.customerA, accountType: 'CUSTOMER' }, fn) as Promise<T>;
const rows = <T = Record<string, unknown>>(r: unknown): T[] => r as T[];

// --- Storage boundary --------------------------------------------------------
describe('public photo Storage boundary (migration 08.3)', () => {
  const PUBLIC_PATH = 'integration/published-cover.txt';
  let service: SupabaseClient | null = null;
  let authed: SupabaseClient | null = null;
  let anon: SupabaseClient | null = null;
  let available = false;

  beforeAll(async () => {
    if (!url || !anonKey || !serviceKey || !ids) return;
    service = createClient(url, serviceKey, { auth: { persistSession: false } });
    anon = createClient(url, anonKey, { auth: { persistSession: false } });
    authed = createClient(url, anonKey, { auth: { persistSession: false } });
    const signIn = await authed.auth.signInWithPassword({ email: 'customer-a@markaz.demo', password: DEMO_PASSWORD });
    if (signIn.error) return;
    const up = await service.storage.from('listing-photos').upload(PUBLIC_PATH, new Blob(['published cover']), { upsert: true, contentType: 'text/plain' });
    available = !up.error;
  });
  afterAll(async () => {
    if (service) await service.storage.from('listing-photos').remove([PUBLIC_PATH, 'integration/customer-write.txt']);
  });

  it('the publication service (service-role) can copy and clean up public photos', async () => {
    if (!available) return;
    const tmp = 'integration/service-copy.txt';
    const up = await service!.storage.from('listing-photos').upload(tmp, new Blob(['svc']), { upsert: true });
    expect(up.error).toBeNull();
    const rm = await service!.storage.from('listing-photos').remove([tmp]);
    expect(rm.error).toBeNull();
  });

  it('anonymous and authenticated customers can READ a published photo', async () => {
    if (!available) return;
    const pub = service!.storage.from('listing-photos').getPublicUrl(PUBLIC_PATH);
    expect((await fetch(pub.data.publicUrl)).status).toBe(200);
    const dl = await authed!.storage.from('listing-photos').download(PUBLIC_PATH);
    expect(dl.error).toBeNull();
  });

  it('an authenticated customer CANNOT insert into the public bucket', async () => {
    if (!available) return;
    const up = await authed!.storage.from('listing-photos').upload('integration/customer-write.txt', new Blob(['nope']), { upsert: false });
    expect(up.error).not.toBeNull();
  });

  it('an authenticated customer CANNOT overwrite or delete a public object', async () => {
    if (!available) return;
    // Overwrite (update) attempt.
    const over = await authed!.storage.from('listing-photos').upload(PUBLIC_PATH, new Blob(['hacked']), { upsert: true });
    expect(over.error).not.toBeNull();
    // Delete attempt — object must survive (RLS filters the delete to nothing).
    await authed!.storage.from('listing-photos').remove([PUBLIC_PATH]);
    const stillThere = await service!.storage.from('listing-photos').download(PUBLIC_PATH);
    expect(stillThere.error).toBeNull();
  });
});

// --- property_photos.public_path protection ---------------------------------
describe('public_path is server-only (guard_public_photo_path trigger)', () => {
  it('an authenticated customer CANNOT set public_path on their own photo', async () => {
    if (!ids) return;
    await expect(
      asA((tx) =>
        tx.execute(sql`update public.property_photos set public_path = 'hack/cover.jpg'
                       where listing_id = ${L.aReady}`),
      ),
    ).rejects.toThrow();
  });

  it('an authenticated customer CANNOT insert a photo carrying a public_path', async () => {
    if (!ids) return;
    await expect(
      asA((tx) =>
        tx.execute(sql`insert into public.property_photos (listing_id, storage_path, public_path, is_cover, sort_order)
                       values (${L.aReady}, 'listing-photos-draft/x.jpg', 'hack/x.jpg', false, 99)`),
      ),
    ).rejects.toThrow();
  });

  it('the elevated postgres role CAN set/clear public_path (publication pipeline path)', async () => {
    if (!ids) return;
    const db = getAppDb();
    const before = rows<{ id: string; public_path: string | null }>(
      await db.execute(sql`select id::text, public_path from public.property_photos where listing_id = ${L.aReady} order by sort_order limit 1`),
    )[0];
    if (!before) return;
    await db.execute(sql`update public.property_photos set public_path = 'integration/elevated.jpg' where id = ${before.id}`);
    const mid = rows<{ public_path: string }>(await db.execute(sql`select public_path from public.property_photos where id = ${before.id}`))[0];
    expect(mid?.public_path).toBe('integration/elevated.jpg');
    // restore
    await db.execute(sql`update public.property_photos set public_path = ${before.public_path} where id = ${before.id}`);
  });
});

// --- saved_properties database boundary --------------------------------------
describe('saved_properties database boundary (migration 08.3)', () => {
  async function clearSave(listingId: string) {
    await getAppDb().execute(sql`delete from public.saved_properties where customer_id = ${ids!.customerA} and listing_id = ${listingId}`);
  }
  async function restoreSave(listingId: string) {
    await getAppDb().execute(sql`insert into public.saved_properties (customer_id, listing_id) values (${ids!.customerA}, ${listingId}) on conflict do nothing`);
  }

  it('Customer A CAN save Customer B\'s LIVE listing', async () => {
    if (!ids) return;
    await clearSave(L.bLive);
    await asA((tx) => tx.execute(sql`insert into public.saved_properties (customer_id, listing_id) values (${ids!.customerA}, ${L.bLive})`));
    const got = rows(await getAppDb().execute(sql`select id from public.saved_properties where customer_id = ${ids!.customerA} and listing_id = ${L.bLive}`));
    expect(got).toHaveLength(1);
  });

  it('Customer A CANNOT save their OWN listing', async () => {
    if (!ids) return;
    await clearSave(L.aLive);
    await expect(
      asA((tx) => tx.execute(sql`insert into public.saved_properties (customer_id, listing_id) values (${ids!.customerA}, ${L.aLive})`)),
    ).rejects.toThrow();
  });

  it('Customer A CANNOT save a PAUSED listing', async () => {
    if (!ids) return;
    await clearSave(L.bPaused);
    await expect(
      asA((tx) => tx.execute(sql`insert into public.saved_properties (customer_id, listing_id) values (${ids!.customerA}, ${L.bPaused})`)),
    ).rejects.toThrow();
    await restoreSave(L.bPaused); // restore the seeded "unavailable saved" stub
  });

  it('Customer A CANNOT save a non-LIVE (DRAFT) listing', async () => {
    if (!ids) return;
    await expect(
      asA((tx) => tx.execute(sql`insert into public.saved_properties (customer_id, listing_id) values (${ids!.customerA}, ${L.bDraft})`)),
    ).rejects.toThrow();
  });

  it('Customer A CANNOT insert a save row on behalf of Customer B', async () => {
    if (!ids) return;
    await expect(
      asA((tx) => tx.execute(sql`insert into public.saved_properties (customer_id, listing_id) values (${ids!.customerB}, ${L.bLive})`)),
    ).rejects.toThrow();
  });

  it('Customer A CANNOT read Customer B\'s saved rows', async () => {
    if (!ids) return;
    // Ensure B has at least one save (as postgres).
    await getAppDb().execute(sql`insert into public.saved_properties (customer_id, listing_id) values (${ids!.customerB}, ${L.aLive}) on conflict do nothing`);
    const visible = await asA((tx) => tx.execute(sql`select id from public.saved_properties where customer_id = ${ids!.customerB}`));
    expect(rows(visible)).toHaveLength(0);
    await getAppDb().execute(sql`delete from public.saved_properties where customer_id = ${ids!.customerB} and listing_id = ${L.aLive}`);
  });

  it('Customer A CAN remove their own save', async () => {
    if (!ids) return;
    await restoreSave(L.bLive);
    await asA((tx) => tx.execute(sql`delete from public.saved_properties where customer_id = ${ids!.customerA} and listing_id = ${L.bLive}`));
    const got = rows(await getAppDb().execute(sql`select id from public.saved_properties where customer_id = ${ids!.customerA} and listing_id = ${L.bLive}`));
    expect(got).toHaveLength(0);
    await restoreSave(L.bLive); // leave the seed's available-saved card intact
  });
});
