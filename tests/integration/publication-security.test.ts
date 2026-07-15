/**
 * Week 3 closure — direct DATABASE and STORAGE boundary proofs (migration 08.3).
 * These bypass tRPC and exercise the real RLS / trigger / Storage policies.
 * SELF-PROVISIONS its principals + listings (no demo seed) and targets the LOCAL
 * Supabase stack (storageEnv() refuses any non-loopback URL). Skips honestly only
 * when the local stack/env is unavailable.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type SupabaseClient } from '@supabase/supabase-js';
import {
  asService,
  asUser,
  cleanup,
  closePool,
  createAuthedPrincipal,
  createListing,
  createPhoto,
  createPrincipal,
  dbReachable,
  expectError,
  saveListingAs,
} from './helpers/db';
import { anonClient, serviceClient, signedInClient, storageEnv } from './helpers/storage';

const env = storageEnv();
const reachable = env ? await dbReachable() : false;
const d = reachable ? describe : describe.skip;
if (!reachable) {
  // eslint-disable-next-line no-console
  console.warn('[publication-security] skipped — local Supabase stack/env not reachable');
}

// One shared postgres pool backs every describe in this file — close it once, at the end.
afterAll(async () => {
  await closePool();
});

// --- Storage boundary --------------------------------------------------------
d('public photo Storage boundary (migration 08.3)', () => {
  let service: SupabaseClient;
  let anon: SupabaseClient;
  let authed: SupabaseClient;
  let prefix = '';
  let publicPath = '';

  beforeAll(async () => {
    service = serviceClient(env!);
    anon = anonClient(env!);
    const principal = await createAuthedPrincipal('pubsec_storage');
    if (!principal) throw new Error('expected an authed principal in a reachable stack');
    authed = await signedInClient(env!, principal.email, principal.password);
    prefix = `itest-${principal.id.replace(/-/g, '').slice(0, 8)}`;
    publicPath = `${prefix}/published-cover.txt`;
    await service.storage.from('listing-photos').upload(publicPath, new Blob(['published cover']), {
      upsert: true,
      contentType: 'text/plain',
    });
  });
  afterAll(async () => {
    await service.storage
      .from('listing-photos')
      .remove([publicPath, `${prefix}/customer-write.txt`, `${prefix}/service-copy.txt`]);
    await cleanup();
  });

  it('the publication service (service-role) can copy and clean up public photos', async () => {
    const tmp = `${prefix}/service-copy.txt`;
    const up = await service.storage
      .from('listing-photos')
      .upload(tmp, new Blob(['svc']), { upsert: true });
    expect(up.error).toBeNull();
    const rm = await service.storage.from('listing-photos').remove([tmp]);
    expect(rm.error).toBeNull();
  });

  it('anonymous and authenticated customers can READ a published photo', async () => {
    const pub = service.storage.from('listing-photos').getPublicUrl(publicPath);
    expect((await fetch(pub.data.publicUrl)).status).toBe(200);
    const dl = await authed.storage.from('listing-photos').download(publicPath);
    expect(dl.error).toBeNull();
    const anonDl = await anon.storage.from('listing-photos').download(publicPath);
    expect(anonDl.error).toBeNull();
  });

  it('an authenticated customer CANNOT insert into the public bucket', async () => {
    const up = await authed.storage
      .from('listing-photos')
      .upload(`${prefix}/customer-write.txt`, new Blob(['nope']), { upsert: false });
    expect(up.error).not.toBeNull();
  });

  it('an authenticated customer CANNOT overwrite or delete a public object', async () => {
    const over = await authed.storage
      .from('listing-photos')
      .upload(publicPath, new Blob(['hacked']), { upsert: true });
    expect(over.error).not.toBeNull();
    // Delete attempt — object must survive (RLS filters the delete to nothing).
    await authed.storage.from('listing-photos').remove([publicPath]);
    const stillThere = await service.storage.from('listing-photos').download(publicPath);
    expect(stillThere.error).toBeNull();
  });
});

// --- property_photos.public_path protection ---------------------------------
d('public_path is server-only (guard_public_photo_path trigger)', () => {
  let customerA = '';
  let ready = '';
  let photoId = '';

  beforeAll(async () => {
    customerA = await createPrincipal('pubsec_pp');
    ready = await createListing(customerA, { state: 'READY_TO_PUBLISH' });
    photoId = await createPhoto(ready, {
      isCover: true,
      sortOrder: 0,
      storagePath: `${customerA}/${ready}/p0.jpg`,
    });
    await createPhoto(ready, {
      isCover: false,
      sortOrder: 1,
      storagePath: `${customerA}/${ready}/p1.jpg`,
    });
  });
  afterAll(async () => {
    await cleanup();
  });

  it('an authenticated customer CANNOT set public_path on their own photo', async () => {
    await expectError(
      () =>
        asUser(
          customerA,
          (tx) =>
            tx`update public.property_photos set public_path = 'hack/cover.jpg' where listing_id = ${ready}`,
        ),
      /publication service|permission denied|check/i,
    );
  });

  it('an authenticated customer CANNOT insert a photo carrying a public_path', async () => {
    await expectError(
      () =>
        asUser(
          customerA,
          (tx) =>
            tx`insert into public.property_photos (listing_id, storage_path, public_path, is_cover, sort_order)
               values (${ready}, 'listing-photos-draft/x.jpg', 'hack/x.jpg', false, 99)`,
        ),
      /publication service|permission denied|check|violates/i,
    );
  });

  it('the elevated postgres role CAN set/clear public_path (publication pipeline path)', async () => {
    await asService(
      (tx) =>
        tx`update public.property_photos set public_path = 'integration/elevated.jpg' where id = ${photoId}`,
    );
    const mid = await asService(
      (tx) => tx`select public_path from public.property_photos where id = ${photoId}`,
    );
    expect((mid[0] as { public_path: string }).public_path).toBe('integration/elevated.jpg');
    await asService(
      (tx) => tx`update public.property_photos set public_path = null where id = ${photoId}`,
    );
  });
});

// --- saved_properties database boundary --------------------------------------
d('saved_properties database boundary (migration 08.3)', () => {
  let customerA = '';
  let customerB = '';
  let aLive = '';
  let bLive = '';
  let bPaused = '';
  let bDraft = '';

  beforeAll(async () => {
    customerA = await createPrincipal('pubsec_save_a');
    customerB = await createPrincipal('pubsec_save_b');
    aLive = await createListing(customerA, { state: 'LIVE' });
    bLive = await createListing(customerB, { state: 'LIVE' });
    bPaused = await createListing(customerB, { state: 'PAUSED' });
    bDraft = await createListing(customerB, { state: 'DRAFT' });
  });
  afterAll(async () => {
    await cleanup();
  });

  it("Customer A CAN save Customer B's LIVE listing", async () => {
    await asUser(
      customerA,
      (tx) =>
        tx`insert into public.saved_properties (customer_id, listing_id) values (${customerA}, ${bLive})`,
    );
    const got = await asService(
      (tx) =>
        tx`select id from public.saved_properties where customer_id = ${customerA} and listing_id = ${bLive}`,
    );
    expect(got.length).toBe(1);
  });

  it('Customer A CANNOT save their OWN listing', async () => {
    await expectError(
      () =>
        asUser(
          customerA,
          (tx) =>
            tx`insert into public.saved_properties (customer_id, listing_id) values (${customerA}, ${aLive})`,
        ),
      /violates row-level security|new row violates|permission denied/i,
    );
  });

  it('Customer A CANNOT save a PAUSED listing', async () => {
    await expectError(
      () =>
        asUser(
          customerA,
          (tx) =>
            tx`insert into public.saved_properties (customer_id, listing_id) values (${customerA}, ${bPaused})`,
        ),
      /violates row-level security|new row violates|permission denied/i,
    );
  });

  it('Customer A CANNOT save a non-LIVE (DRAFT) listing', async () => {
    await expectError(
      () =>
        asUser(
          customerA,
          (tx) =>
            tx`insert into public.saved_properties (customer_id, listing_id) values (${customerA}, ${bDraft})`,
        ),
      /violates row-level security|new row violates|permission denied/i,
    );
  });

  it('Customer A CANNOT insert a save row on behalf of Customer B', async () => {
    await expectError(
      () =>
        asUser(
          customerA,
          (tx) =>
            tx`insert into public.saved_properties (customer_id, listing_id) values (${customerB}, ${bLive})`,
        ),
      /violates row-level security|new row violates|permission denied/i,
    );
  });

  it("Customer A CANNOT read Customer B's saved rows", async () => {
    // Ensure B has at least one save (as the postgres role).
    await saveListingAs(customerB, aLive);
    const visible = await asUser(
      customerA,
      (tx) => tx`select id from public.saved_properties where customer_id = ${customerB}`,
    );
    expect(visible.length).toBe(0);
  });

  it('Customer A CAN remove their own save', async () => {
    await asUser(
      customerA,
      (tx) =>
        tx`delete from public.saved_properties where customer_id = ${customerA} and listing_id = ${bLive}`,
    );
    const got = await asService(
      (tx) =>
        tx`select id from public.saved_properties where customer_id = ${customerA} and listing_id = ${bLive}`,
    );
    expect(got.length).toBe(0);
  });
});
