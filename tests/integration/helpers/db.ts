/**
 * Integration-test DB harness for the Week-4 offer system.
 *
 * These tests exercise the REAL security boundary — RLS + the SECURITY DEFINER
 * offer functions — against the local Supabase Postgres. They replicate the app's
 * identity propagation (`packages/db/src/rls-context.ts`): every customer-scoped
 * statement runs inside a transaction that sets `request.jwt.claims` and switches
 * to the restricted `authenticated`/`anon` role, so `auth.uid()` resolves and RLS
 * evaluates exactly as it does in production.
 *
 * SAFETY: these tests INSERT/DELETE data, so they refuse to run against anything
 * but a loopback host. They deliberately IGNORE the ambient `DATABASE_URL` (which
 * may point at a remote/hosted database) and default to the local CLI Postgres.
 * Override only with `TEST_DATABASE_URL`, which must also be loopback.
 */
import postgres from 'postgres';
import { createClient } from '@supabase/supabase-js';
import { storageEnv } from './storage';

const LOCAL_DEFAULT = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

function resolveUrl(): string {
  const url = process.env.TEST_DATABASE_URL ?? LOCAL_DEFAULT;
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    throw new Error(`TEST_DATABASE_URL is not a valid URL: ${url}`);
  }
  const loopback = host === '127.0.0.1' || host === 'localhost' || host === '::1';
  if (!loopback) {
    throw new Error(
      `Refusing to run destructive integration tests against non-loopback host "${host}". ` +
        `Point TEST_DATABASE_URL at the local Supabase stack (default ${LOCAL_DEFAULT}).`,
    );
  }
  return url;
}

export const TEST_DATABASE_URL = resolveUrl();

// One shared pool; `max` comfortably above the 2 connections the concurrency test needs.
// Short timeouts so suites SKIP cleanly (rather than hang) when the stack is down.
export const sql = postgres(TEST_DATABASE_URL, {
  max: 8,
  connect_timeout: 5,
  idle_timeout: 2,
  onnotice: () => {},
  prepare: false,
});

export type Sql = typeof sql;

/** Is the local stack reachable? Used to skip (not fail) when Docker/DB is down. */
export async function dbReachable(): Promise<boolean> {
  try {
    await sql`select 1`;
    return true;
  } catch {
    return false;
  }
}

/** Run trusted setup/inspection as the connection's own (postgres) role — bypasses RLS. */
export function asService<T>(fn: (tx: Sql) => Promise<T>): Promise<T> {
  return sql.begin((tx) => fn(tx as unknown as Sql)) as Promise<T>;
}

/** Run work as the authenticated customer `userId`, under RLS (mirrors withUserContext). */
export function asUser<T>(userId: string, fn: (tx: Sql) => Promise<T>): Promise<T> {
  return sql.begin(async (tx) => {
    const claims = JSON.stringify({ sub: userId, role: 'authenticated', account_type: 'CUSTOMER' });
    await tx`select set_config('request.jwt.claims', ${claims}, true)`;
    await tx`select set_config('role', 'authenticated', true)`;
    return fn(tx as unknown as Sql);
  }) as Promise<T>;
}

/** Run work as an anonymous visitor (mirrors withAnonContext). */
export function asAnon<T>(fn: (tx: Sql) => Promise<T>): Promise<T> {
  return sql.begin(async (tx) => {
    await tx`select set_config('request.jwt.claims', ${JSON.stringify({ role: 'anon' })}, true)`;
    await tx`select set_config('role', 'anon', true)`;
    return fn(tx as unknown as Sql);
  }) as Promise<T>;
}

const createdUserIds: string[] = [];
const createdListingIds: string[] = [];

let seq = 0;
function uniqueEmail(tag: string): string {
  seq += 1;
  // Unique per process without Date.now(): pid + monotonic counter.
  return `itest_${tag}_${process.pid}_${seq}@markaz.test`;
}

export interface Principal {
  id: string;
  email: string;
}

/**
 * Create an onboarded CUSTOMER principal (auth.users → handle_new_user trigger
 * creates the profile) and return its id + generated email.
 */
export async function createNamedPrincipal(tag: string): Promise<Principal> {
  const email = uniqueEmail(tag);
  const id = await asService(async (tx) => {
    const [u] = await tx`
      insert into auth.users (id, email, aud, role, created_at, updated_at)
      values (gen_random_uuid(), ${email}, 'authenticated', 'authenticated', now(), now())
      returning id`;
    const uid = (u as { id: string }).id;
    await tx`update public.profiles set onboarding_completed_at = now() where id = ${uid}`;
    createdUserIds.push(uid);
    return uid;
  });
  return { id, email };
}

/** Create an onboarded CUSTOMER principal and return its id. */
export async function createPrincipal(tag: string): Promise<string> {
  return (await createNamedPrincipal(tag)).id;
}

export interface AuthedPrincipal extends Principal {
  password: string;
}

/**
 * Create a CUSTOMER with a KNOWN password via the Supabase Admin API, so the test
 * can `signInWithPassword` and exercise Storage RLS as a real authenticated user.
 * Returns null when the local Supabase env is unavailable (Storage proofs self-skip).
 * `storageEnv()` refuses any non-loopback URL, so this never touches hosted Storage.
 */
export async function createAuthedPrincipal(tag: string): Promise<AuthedPrincipal | null> {
  const env = storageEnv();
  if (!env) return null;
  const email = uniqueEmail(tag);
  const password = 'Itest!Pass1';
  const admin = createClient(env.url, env.serviceKey, { auth: { persistSession: false } });
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error('Admin API createUser returned no user');
  const id = data.user.id;
  createdUserIds.push(id);
  await asService(
    (tx) => tx`update public.profiles set onboarding_completed_at = now() where id = ${id}`,
  );
  return { id, email, password };
}

/** Create an ADMIN principal (profile.account_type = 'ADMIN' so is_admin() resolves). */
export async function createAdmin(tag: string): Promise<string> {
  const id = await createPrincipal(tag);
  await asService((tx) => tx`update public.profiles set account_type = 'ADMIN' where id = ${id}`);
  return id;
}

/** Run work as the authenticated ADMIN `userId`, under RLS (is_admin() reads the DB profile). */
export function asAdmin<T>(userId: string, fn: (tx: Sql) => Promise<T>): Promise<T> {
  return sql.begin(async (tx) => {
    const claims = JSON.stringify({ sub: userId, role: 'authenticated', account_type: 'ADMIN' });
    await tx`select set_config('request.jwt.claims', ${claims}, true)`;
    await tx`select set_config('role', 'authenticated', true)`;
    return fn(tx as unknown as Sql);
  }) as Promise<T>;
}

/** A listing lifecycle state (see the `listing_state` enum). */
export type ListingState =
  | 'DRAFT'
  | 'DETAILS_COMPLETE'
  | 'DOCUMENT_UPLOADED'
  | 'OWNERSHIP_REVIEW'
  | 'OWNERSHIP_VERIFIED'
  | 'FORM_A_COMPLETE'
  | 'PHOTOS_COMPLETE'
  | 'PERMIT_PENDING'
  | 'READY_TO_PUBLISH'
  | 'LIVE'
  | 'PAUSED'
  | 'REJECTED'
  | 'SOLD_DEMO';

export interface CreateListingOpts {
  state?: ListingState;
  askingPrice?: number;
  minNotificationPrice?: number | null;
  /** Explicit `public_id`; omit to auto-assign one for published (LIVE/PAUSED) states, null otherwise. */
  publicId?: string | null;
}

/**
 * Create a listing owned by `ownerId` in any lifecycle state. Published states
 * (LIVE/PAUSED) get a `public_id` so they satisfy the marketplace view's guard;
 * pre-publication states get none. Direct insert (as the postgres role) — the
 * customer-facing state machine is exercised separately via the tRPC router tests.
 */
export async function createListing(
  ownerId: string,
  opts: CreateListingOpts = {},
): Promise<string> {
  const state: ListingState = opts.state ?? 'LIVE';
  const asking = opts.askingPrice ?? 2_100_000;
  const min = opts.minNotificationPrice ?? null;
  return asService(async (tx) => {
    const [l] = await tx`
      insert into public.listings
        (id, owner_id, title, state, version, publication_version, asking_price, min_notification_price)
      values
        (gen_random_uuid(), ${ownerId}, 'Integration Test Villa', ${state}::public.listing_state, 1, 1,
         ${asking}, ${min})
      returning id`;
    const id = (l as { id: string }).id;
    createdListingIds.push(id);
    const published = state === 'LIVE' || state === 'PAUSED';
    const publicId =
      opts.publicId !== undefined
        ? opts.publicId
        : published
          ? `itest-${id.replace(/-/g, '').slice(0, 8)}`
          : null;
    if (publicId !== null) {
      await tx`update public.listings set public_id = ${publicId} where id = ${id}`;
    }
    return id;
  });
}

/** Create a LIVE listing owned by `ownerId`. */
export async function createLiveListing(
  ownerId: string,
  opts: { minNotificationPrice?: number | null; askingPrice?: number } = {},
): Promise<string> {
  return createListing(ownerId, {
    state: 'LIVE',
    minNotificationPrice: opts.minNotificationPrice ?? null,
    askingPrice: opts.askingPrice,
  });
}

/** Attach a photo row to `listingId`. `publicPath` is set as the postgres role (bypasses the customer guard). */
export async function createPhoto(
  listingId: string,
  opts: {
    isCover?: boolean;
    sortOrder?: number;
    storagePath?: string;
    publicPath?: string | null;
    contentType?: string;
  } = {},
): Promise<string> {
  return asService(async (tx) => {
    const [p] = await tx`
      insert into public.property_photos
        (listing_id, storage_path, is_cover, sort_order, content_type, public_path)
      values
        (${listingId}, ${opts.storagePath ?? `${listingId}/photo.jpg`}, ${opts.isCover ?? true},
         ${opts.sortOrder ?? 0}, ${opts.contentType ?? 'image/jpeg'}, ${opts.publicPath ?? null})
      returning id`;
    return (p as { id: string }).id;
  });
}

/** Attach a private ownership document to `listingId`. */
export async function createOwnershipDocument(
  listingId: string,
  ownerId: string,
  opts: { documentType?: string; storagePath?: string } = {},
): Promise<string> {
  return asService(async (tx) => {
    const [d] = await tx`
      insert into public.ownership_documents
        (listing_id, owner_id, document_type, storage_path)
      values
        (${listingId}, ${ownerId}, ${opts.documentType ?? 'TITLE_DEED'},
         ${opts.storagePath ?? `${ownerId}/${listingId}/deed.pdf`})
      returning id`;
    return (d as { id: string }).id;
  });
}

/** Attach an investment case to `listingId`. */
export async function createInvestmentCase(
  listingId: string,
  opts: { originalPurchasePrice?: number; visible?: boolean } = {},
): Promise<string> {
  return asService(async (tx) => {
    const [c] = await tx`
      insert into public.investment_cases
        (listing_id, original_purchase_price, visible)
      values
        (${listingId}, ${opts.originalPurchasePrice ?? 1_750_000}, ${opts.visible ?? true})
      returning id`;
    return (c as { id: string }).id;
  });
}

/** Seed a save row (as the postgres role — bypasses RLS) to set up cross-customer read scenarios. */
export async function saveListingAs(customerId: string, listingId: string): Promise<void> {
  await asService(
    (tx) =>
      tx`insert into public.saved_properties (customer_id, listing_id)
         values (${customerId}, ${listingId}) on conflict do nothing`,
  );
}

/** Assert a callback rejects with a message matching `matcher`. */
export async function expectError(
  fn: () => Promise<unknown>,
  matcher: RegExp | string,
): Promise<void> {
  let threw = false;
  try {
    await fn();
  } catch (e) {
    threw = true;
    const msg = e instanceof Error ? e.message : String(e);
    const ok = matcher instanceof RegExp ? matcher.test(msg) : msg.includes(matcher);
    if (!ok) throw new Error(`Expected error matching ${matcher}, but got: ${msg}`);
  }
  if (!threw) throw new Error(`Expected error matching ${matcher}, but the call succeeded`);
}

/** Remove everything this run created (auth.users cascade → profiles/threads/proposals/events). */
export async function cleanup(): Promise<void> {
  await asService(async (tx) => {
    if (createdListingIds.length)
      await tx`delete from public.listings where id in ${tx(createdListingIds)}`;
    if (createdUserIds.length) await tx`delete from auth.users where id in ${tx(createdUserIds)}`;
  });
  createdListingIds.length = 0;
  createdUserIds.length = 0;
}

export async function closePool(): Promise<void> {
  await sql.end({ timeout: 5 });
}
