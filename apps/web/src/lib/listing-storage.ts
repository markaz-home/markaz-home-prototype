import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Listing storage helpers. Private ownership documents and PRIVATE draft photos
 * (ADR-0011) are uploaded with the user's own session (RLS enforces owner) and
 * read via short-lived signed URLs — never public URLs. The service-role key is
 * never used for these customer-scoped operations.
 */
export const OWNERSHIP_BUCKET = 'ownership-documents';
export const DRAFT_PHOTO_BUCKET = 'listing-photos-draft';
const SIGNED_URL_TTL = 60 * 30; // 30 minutes

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);
}

export function buildObjectPath(userId: string, listingId: string, fileName: string): string {
  const rand = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`;
  return `${userId}/${listingId}/${rand}-${safeName(fileName)}`;
}

export async function uploadObject(
  supabase: SupabaseClient,
  bucket: string,
  path: string,
  file: File,
): Promise<{ path: string }> {
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw error;
  return { path };
}

export async function getSignedUrl(
  supabase: SupabaseClient,
  bucket: string,
  path: string,
  expiresIn = SIGNED_URL_TTL,
): Promise<string | null> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error || !data) return null;
  return data.signedUrl;
}

export async function getSignedUrls(
  supabase: SupabaseClient,
  bucket: string,
  paths: string[],
  expiresIn = SIGNED_URL_TTL,
): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const { data, error } = await supabase.storage.from(bucket).createSignedUrls(paths, expiresIn);
  if (error || !data) return {};
  const map: Record<string, string> = {};
  for (const item of data) {
    if (item.path && item.signedUrl) map[item.path] = item.signedUrl;
  }
  return map;
}

export async function removeObjects(supabase: SupabaseClient, bucket: string, paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  await supabase.storage.from(bucket).remove(paths);
}
