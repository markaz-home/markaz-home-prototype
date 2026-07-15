/**
 * Storage-boundary test helpers. These exercise the REAL Supabase Storage API
 * (the supported path — newer Storage blocks raw SQL writes to storage.objects).
 *
 * SAFETY: like the DB harness, these tests INSERT/DELETE objects, so they refuse
 * to run against anything but a loopback Supabase URL. `storageEnv()` throws on a
 * non-loopback `NEXT_PUBLIC_SUPABASE_URL` rather than silently touching hosted
 * Storage, and returns null (→ suite self-skips) when the env is simply unset.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function isLoopback(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === '127.0.0.1' || host === 'localhost' || host === '::1';
  } catch {
    return false;
  }
}

export interface StorageEnv {
  url: string;
  anonKey: string;
  serviceKey: string;
}

/**
 * The local Supabase Storage env, or null when unset. Throws if a non-loopback
 * URL is configured — destructive Storage tests must never reach hosted Storage.
 */
export function storageEnv(): StorageEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) return null;
  if (!isLoopback(url)) {
    throw new Error(
      `Refusing to run destructive Storage tests against non-loopback Supabase URL "${url}". ` +
        `Point NEXT_PUBLIC_SUPABASE_URL at the local stack (http://127.0.0.1:54321).`,
    );
  }
  return { url, anonKey, serviceKey };
}

export function serviceClient(env: StorageEnv): SupabaseClient {
  return createClient(env.url, env.serviceKey, { auth: { persistSession: false } });
}

/** Is the local Storage API reachable? Used to skip (never vacuously pass) when it is down. */
export async function storageReachable(env: StorageEnv): Promise<boolean> {
  try {
    const { error } = await serviceClient(env)
      .storage.from('listing-photos')
      .list('', { limit: 1 });
    return !error;
  } catch {
    return false;
  }
}

export function anonClient(env: StorageEnv): SupabaseClient {
  return createClient(env.url, env.anonKey, { auth: { persistSession: false } });
}

/** A fresh anon client signed in as `email`/`password` (for authenticated Storage RLS proofs). */
export async function signedInClient(
  env: StorageEnv,
  email: string,
  password: string,
): Promise<SupabaseClient> {
  const client = createClient(env.url, env.anonKey, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}
