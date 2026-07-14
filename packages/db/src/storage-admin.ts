import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { eq } from 'drizzle-orm';
import { getDirectDb } from './client';
import { propertyPhotos } from './schema';

/**
 * NARROW server-only public-photo pipeline (Week 3, ADR-0012). This is the ONLY
 * place the service-role key is used for a customer-scoped flow: copying APPROVED
 * draft photos from the PRIVATE `listing-photos-draft` bucket into the PUBLIC
 * `listing-photos` bucket at opaque paths, during publication. Ownership documents
 * are NEVER touched here. All other customer operations use the user's own session.
 */
const DRAFT_BUCKET = 'listing-photos-draft';
const PUBLIC_BUCKET = 'listing-photos';

let client: SupabaseClient | null = null;
function admin(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new Error('public-photo pipeline: missing SUPABASE url / service-role key');
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

/** Deterministic public object key. Stable across retries → idempotent copies. */
export function publicPhotoKey(publicId: string, photoId: string): string {
  return `${publicId}/${photoId}`;
}

/** Copy one draft object into the public bucket. Idempotent (upsert + stable key). */
export async function copyDraftPhotoToPublic(
  draftPath: string,
  publicPath: string,
  contentType?: string,
): Promise<void> {
  const sb = admin();
  const { data, error } = await sb.storage.from(DRAFT_BUCKET).download(draftPath);
  if (error || !data) throw new Error(`draft download failed: ${draftPath}`);
  const { error: upErr } = await sb.storage.from(PUBLIC_BUCKET).upload(publicPath, data, {
    contentType: contentType || data.type || 'image/jpeg',
    upsert: true,
  });
  if (upErr) throw new Error(`public upload failed: ${publicPath}`);
}

/** Verify every prepared public object actually exists (catches partial copies). */
export async function verifyPublicPhotos(publicId: string, photoIds: string[]): Promise<boolean> {
  if (photoIds.length === 0) return true;
  const { data, error } = await admin().storage.from(PUBLIC_BUCKET).list(publicId, { limit: 1000 });
  if (error || !data) return false;
  const present = new Set(data.map((o) => o.name));
  return photoIds.every((id) => present.has(id));
}

/** Remove public objects (cleanup on failure / re-publication). Idempotent and
 * safe to call repeatedly; only removes the supplied keys, never a broad prefix. */
export async function removePublicPhotos(publicPaths: string[]): Promise<void> {
  if (publicPaths.length === 0) return;
  await admin()
    .storage.from(PUBLIC_BUCKET)
    .remove(publicPaths)
    .catch(() => {});
}

/**
 * Set property_photos.public_path via the app's elevated `postgres` connection —
 * the only path the `guard_public_photo_path` trigger permits (an `authenticated`
 * customer connection cannot set or change a public path; migration 08.3). This
 * runs OUTSIDE the caller's RLS transaction on the DIRECT (privileged) connection —
 * the trigger permits it only from the elevated role, never an `authenticated`
 * customer connection. The value is server-derived (`${publicId}/${photoId}`) and
 * never customer-supplied.
 */
export async function setPublicPhotoPath(photoId: string, publicPath: string): Promise<void> {
  await getDirectDb()
    .update(propertyPhotos)
    .set({ publicPath })
    .where(eq(propertyPhotos.id, photoId));
}

/** Clear public_path for every photo of a listing (compensation). Idempotent and
 * safe to call repeatedly; runs on the DIRECT (elevated) connection. */
export async function clearPublicPhotoPaths(listingId: string): Promise<void> {
  await getDirectDb()
    .update(propertyPhotos)
    .set({ publicPath: null })
    .where(eq(propertyPhotos.listingId, listingId));
}

// --- Week 5: private transaction documents (participant-scoped; ADR-0023) --------
const TRANSACTION_BUCKET = 'transaction-documents';

/** Short-lived signed URL for a private transaction document. The CALLER must have
 * already verified (under RLS) that the requester uploaded this document — this only
 * mints the URL; it does not authorise. Never log the returned URL or the path. */
export async function transactionDocumentSignedUrl(
  path: string,
  expiresInSeconds = 60,
): Promise<string | null> {
  const { data, error } = await admin()
    .storage.from(TRANSACTION_BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error) return null;
  return data?.signedUrl ?? null;
}

/** Best-effort delete of a private transaction document object. */
export async function removeTransactionDocument(path: string): Promise<void> {
  await admin()
    .storage.from(TRANSACTION_BUCKET)
    .remove([path])
    .catch(() => {});
}

/** Week-6 admin document access: short-lived signed URL for ANY private bucket. The CALLER
 * must have verified admin capability + recorded the access audit event first; this only
 * mints the URL. Never log the returned URL or the path. Buckets are allow-listed. */
const ADMIN_READABLE_BUCKETS = new Set([
  'ownership-documents',
  'transaction-documents',
  'listing-photos-draft',
]);
export async function adminPrivateSignedUrl(
  bucket: string,
  path: string,
  expiresInSeconds = 300,
): Promise<string | null> {
  if (!ADMIN_READABLE_BUCKETS.has(bucket)) return null;
  const { data, error } = await admin()
    .storage.from(bucket)
    .createSignedUrl(path, expiresInSeconds);
  if (error) return null;
  return data?.signedUrl ?? null;
}
