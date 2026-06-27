import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

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
 * Requires the local stack + keys in .env. Self-skips otherwise. Fictional files only.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const PRIVATE_PATH = 'integration/title-deed-sample.txt';
const PUBLIC_PATH = 'integration/listing-cover.txt';

let available = false;
let service: SupabaseClient | null = null;
let anon: SupabaseClient | null = null;

beforeAll(async () => {
  if (!url || !anonKey || !serviceKey) return;
  service = createClient(url, serviceKey, { auth: { persistSession: false } });
  anon = createClient(url, anonKey, { auth: { persistSession: false } });
  try {
    const { error } = await service.storage.from('listing-photos').list('', { limit: 1 });
    available = !error;
  } catch {
    available = false;
  }
  if (!available) {
    // eslint-disable-next-line no-console
    console.warn('[storage.test] Skipped — local Supabase Storage not reachable.');
    return;
  }
  await service.storage.from('ownership-documents').remove([PRIVATE_PATH]);
  await service.storage.from('listing-photos').remove([PUBLIC_PATH]);
});

afterAll(async () => {
  if (available && service) {
    await service.storage.from('ownership-documents').remove([PRIVATE_PATH]);
    await service.storage.from('listing-photos').remove([PUBLIC_PATH]);
  }
});

describe('storage boundary (Storage API)', () => {
  it('public listing photos are world-readable', async () => {
    if (!available) return;
    const up = await service!.storage
      .from('listing-photos')
      .upload(PUBLIC_PATH, new Blob(['demo cover']), { upsert: true, contentType: 'text/plain' });
    expect(up.error).toBeNull();

    const { data } = service!.storage.from('listing-photos').getPublicUrl(PUBLIC_PATH);
    const res = await fetch(data.publicUrl);
    expect(res.status).toBe(200);
  });

  it('private ownership doc is not publicly accessible but is via a signed URL', async () => {
    if (!available) return;
    const up = await service!.storage
      .from('ownership-documents')
      .upload(PRIVATE_PATH, new Blob(['fictional title deed']), {
        upsert: true,
        contentType: 'text/plain',
      });
    expect(up.error).toBeNull();

    // A public URL must NOT serve a private object.
    const pub = service!.storage.from('ownership-documents').getPublicUrl(PRIVATE_PATH);
    const pubRes = await fetch(pub.data.publicUrl);
    expect(pubRes.status).not.toBe(200);

    // An anonymous client cannot download it (no RLS grant).
    const anonDl = await anon!.storage.from('ownership-documents').download(PRIVATE_PATH);
    expect(anonDl.error).toBeTruthy();
    expect(anonDl.data).toBeNull();

    // A signed URL issued by an authorised party grants time-limited access.
    const signed = await service!.storage
      .from('ownership-documents')
      .createSignedUrl(PRIVATE_PATH, 60);
    expect(signed.error).toBeNull();
    const signedRes = await fetch(signed.data!.signedUrl);
    expect(signedRes.status).toBe(200);
  });

  it('bucket visibility flags are correct', async () => {
    if (!available) return;
    const priv = await service!.storage.getBucket('ownership-documents');
    expect(priv.data?.public).toBe(false);
    const pub = await service!.storage.getBucket('listing-photos');
    expect(pub.data?.public).toBe(true);
  });
});
