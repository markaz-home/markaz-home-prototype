import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { type SupabaseClient } from '@supabase/supabase-js';
import { anonClient, serviceClient, storageEnv, storageReachable } from './helpers/storage';

/**
 * Storage boundary proof (Step 16) via the Supabase Storage API (the supported
 * path — newer Storage blocks raw SQL writes to storage.objects):
 *   - public listing photos are world-readable,
 *   - private ownership documents are NOT publicly accessible,
 *   - a signed URL grants time-limited access to a private object,
 *   - an anonymous client cannot download a private object.
 * Per-customer object isolation uses the same `owner = auth.uid()` storage RLS
 * (migration 04); per-customer data isolation is proven in rls.test.ts.
 *
 * SELF-SKIPS HONESTLY when Storage is unreachable: the whole suite reports as
 * SKIPPED (never as passing-with-no-assertions), so CI's skip=fail gate fails when
 * the required stack is down. `storageEnv()` refuses any non-loopback URL. Fictional
 * files only.
 */
const env = storageEnv();
const reachable = env ? await storageReachable(env) : false;
const d = reachable ? describe : describe.skip;
if (!reachable) {
  // eslint-disable-next-line no-console
  console.warn('[storage] skipped — local Supabase Storage not reachable');
}

const PRIVATE_PATH = 'integration/title-deed-sample.txt';
const PUBLIC_PATH = 'integration/listing-cover.txt';

d('storage boundary (Storage API)', () => {
  let service: SupabaseClient;
  let anon: SupabaseClient;

  beforeAll(async () => {
    service = serviceClient(env!);
    anon = anonClient(env!);
    await service.storage.from('ownership-documents').remove([PRIVATE_PATH]);
    await service.storage.from('listing-photos').remove([PUBLIC_PATH]);
  });

  afterAll(async () => {
    await service.storage.from('ownership-documents').remove([PRIVATE_PATH]);
    await service.storage.from('listing-photos').remove([PUBLIC_PATH]);
  });

  it('public listing photos are world-readable', async () => {
    const up = await service.storage
      .from('listing-photos')
      .upload(PUBLIC_PATH, new Blob(['demo cover']), { upsert: true, contentType: 'text/plain' });
    expect(up.error).toBeNull();

    const { data } = service.storage.from('listing-photos').getPublicUrl(PUBLIC_PATH);
    const res = await fetch(data.publicUrl);
    expect(res.status).toBe(200);
  });

  it('private ownership doc is not publicly accessible but is via a signed URL', async () => {
    const up = await service.storage
      .from('ownership-documents')
      .upload(PRIVATE_PATH, new Blob(['fictional title deed']), {
        upsert: true,
        contentType: 'text/plain',
      });
    expect(up.error).toBeNull();

    // A public URL must NOT serve a private object.
    const pub = service.storage.from('ownership-documents').getPublicUrl(PRIVATE_PATH);
    const pubRes = await fetch(pub.data.publicUrl);
    expect(pubRes.status).not.toBe(200);

    // An anonymous client cannot download it (no RLS grant).
    const anonDl = await anon.storage.from('ownership-documents').download(PRIVATE_PATH);
    expect(anonDl.error).toBeTruthy();
    expect(anonDl.data).toBeNull();

    // A signed URL issued by an authorised party grants time-limited access.
    const signed = await service.storage
      .from('ownership-documents')
      .createSignedUrl(PRIVATE_PATH, 60);
    expect(signed.error).toBeNull();
    const signedRes = await fetch(signed.data!.signedUrl);
    expect(signedRes.status).toBe(200);
  });

  it('bucket visibility flags are correct', async () => {
    const priv = await service.storage.getBucket('ownership-documents');
    expect(priv.data?.public).toBe(false);
    const pub = await service.storage.getBucket('listing-photos');
    expect(pub.data?.public).toBe(true);
  });
});
