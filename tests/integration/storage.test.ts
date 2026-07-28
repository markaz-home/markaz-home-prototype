import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { type SupabaseClient } from '@supabase/supabase-js';
import { asService, cleanup, closePool, createAuthedPrincipal } from './helpers/db';
import {
  anonClient,
  serviceClient,
  signedInClient,
  storageEnv,
  storageReachable,
} from './helpers/storage';

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

const PRIVATE_PATH = 'integration/title-deed-sample.pdf';
const PRIVATE_SCOPE_PATH = 'integration/title-deed-other.pdf';
const PUBLIC_PATH = 'integration/listing-cover.png';
const PDF = new Blob(['%PDF-1.4\n% fictional integration document\n'], {
  type: 'application/pdf',
});
const PNG = new Blob(['fictional image bytes'], { type: 'image/png' });

d('storage boundary (Storage API)', () => {
  let service: SupabaseClient;
  let anon: SupabaseClient;
  let signedInAdmin: SupabaseClient;

  beforeAll(async () => {
    service = serviceClient(env!);
    anon = anonClient(env!);
    const adminPrincipal = await createAuthedPrincipal('storage_admin');
    if (!adminPrincipal) throw new Error('Local Auth/Storage environment is unavailable.');
    await asService(
      (tx) => tx`update public.profiles set account_type = 'ADMIN' where id = ${adminPrincipal.id}`,
    );
    signedInAdmin = await signedInClient(env!, adminPrincipal.email, adminPrincipal.password);
    await service.storage.from('ownership-documents').remove([PRIVATE_PATH, PRIVATE_SCOPE_PATH]);
    await service.storage.from('listing-photos').remove([PUBLIC_PATH]);
  });

  afterAll(async () => {
    await service.storage.from('ownership-documents').remove([PRIVATE_PATH, PRIVATE_SCOPE_PATH]);
    await service.storage.from('listing-photos').remove([PUBLIC_PATH]);
    await cleanup();
    await closePool();
  });

  it('public listing photos are world-readable', async () => {
    const up = await service.storage
      .from('listing-photos')
      .upload(PUBLIC_PATH, PNG, { upsert: true, contentType: 'image/png' });
    expect(up.error).toBeNull();

    const { data } = service.storage.from('listing-photos').getPublicUrl(PUBLIC_PATH);
    const res = await fetch(data.publicUrl);
    expect(res.status).toBe(200);
  });

  it('private ownership doc is not publicly accessible but is via a signed URL', async () => {
    const up = await service.storage.from('ownership-documents').upload(PRIVATE_PATH, PDF, {
      upsert: true,
      contentType: 'application/pdf',
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

  it('signed URLs are object-scoped and expire', async () => {
    const uploads = await Promise.all([
      service.storage.from('ownership-documents').upload(PRIVATE_PATH, PDF, {
        upsert: true,
        contentType: 'application/pdf',
      }),
      service.storage.from('ownership-documents').upload(PRIVATE_SCOPE_PATH, PDF, {
        upsert: true,
        contentType: 'application/pdf',
      }),
    ]);
    expect(uploads.every(({ error }) => error === null)).toBe(true);

    const signed = await service.storage
      .from('ownership-documents')
      .createSignedUrl(PRIVATE_PATH, 1);
    expect(signed.error).toBeNull();
    const url = new URL(signed.data!.signedUrl);
    expect((await fetch(url)).status).toBe(200);

    const wrongObjectUrl = new URL(url);
    wrongObjectUrl.pathname = wrongObjectUrl.pathname.replace(PRIVATE_PATH, PRIVATE_SCOPE_PATH);
    expect((await fetch(wrongObjectUrl)).status).not.toBe(200);

    await new Promise((resolve) => setTimeout(resolve, 2_100));
    expect((await fetch(url)).status).not.toBe(200);
  });

  it('a signed-in Admin cannot bypass the audited private-document access path', async () => {
    const up = await service.storage
      .from('ownership-documents')
      .upload(PRIVATE_PATH, PDF, { upsert: true, contentType: 'application/pdf' });
    expect(up.error).toBeNull();

    const download = await signedInAdmin.storage.from('ownership-documents').download(PRIVATE_PATH);
    expect(download.error).toBeTruthy();
    expect(download.data).toBeNull();

    const directSignedUrl = await signedInAdmin.storage
      .from('ownership-documents')
      .createSignedUrl(PRIVATE_PATH, 60);
    expect(directSignedUrl.error).toBeTruthy();

    const auditedServerCapability = await service.storage
      .from('ownership-documents')
      .createSignedUrl(PRIVATE_PATH, 60);
    expect(auditedServerCapability.error).toBeNull();
  });

  it('bucket visibility, MIME allow-lists, and file-size limits are correct', async () => {
    type BucketWithLimits = {
      public: boolean;
      file_size_limit?: number | null;
      allowed_mime_types?: string[] | null;
    };
    const priv = await service.storage.getBucket('ownership-documents');
    const ownership = priv.data as BucketWithLimits | null;
    expect(ownership?.public).toBe(false);
    expect(ownership?.file_size_limit).toBe(10 * 1024 * 1024);
    expect(ownership?.allowed_mime_types).toEqual(['application/pdf', 'image/jpeg', 'image/png']);

    const draftResult = await service.storage.getBucket('listing-photos-draft');
    const draft = draftResult.data as BucketWithLimits | null;
    expect(draft?.public).toBe(false);
    expect(draft?.file_size_limit).toBe(12 * 1024 * 1024);
    expect(draft?.allowed_mime_types).toEqual(['image/jpeg', 'image/png', 'image/webp']);

    const pub = await service.storage.getBucket('listing-photos');
    const published = pub.data as BucketWithLimits | null;
    expect(published?.public).toBe(true);
    expect(published?.file_size_limit).toBe(12 * 1024 * 1024);
    expect(published?.allowed_mime_types).toEqual(['image/jpeg', 'image/png', 'image/webp']);

    const transactionResult = await service.storage.getBucket('transaction-documents');
    const transaction = transactionResult.data as BucketWithLimits | null;
    expect(transaction?.public).toBe(false);
    expect(transaction?.file_size_limit).toBe(10 * 1024 * 1024);
    expect(transaction?.allowed_mime_types).toEqual(['application/pdf', 'image/jpeg', 'image/png']);
  });
});
