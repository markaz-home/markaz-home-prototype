import { createClient, type SupabaseClient } from '@supabase/supabase-js';

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
  if (!url || !key) throw new Error('public-photo pipeline: missing SUPABASE url / service-role key');
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

/** Copy one draft object into the public bucket. Idempotent (upsert). */
export async function copyDraftPhotoToPublic(draftPath: string, publicPath: string, contentType?: string): Promise<void> {
  const sb = admin();
  const { data, error } = await sb.storage.from(DRAFT_BUCKET).download(draftPath);
  if (error || !data) throw new Error(`draft download failed: ${draftPath}`);
  const { error: upErr } = await sb.storage
    .from(PUBLIC_BUCKET)
    .upload(publicPath, data, { contentType: contentType || data.type || 'image/jpeg', upsert: true });
  if (upErr) throw new Error(`public upload failed: ${publicPath}`);
}

/** Remove public objects (cleanup on failure / re-publication). Best-effort. */
export async function removePublicPhotos(publicPaths: string[]): Promise<void> {
  if (publicPaths.length === 0) return;
  await admin().storage.from(PUBLIC_BUCKET).remove(publicPaths).catch(() => {});
}
