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

/**
 * Create an onboarded CUSTOMER principal (auth.users → handle_new_user trigger
 * creates the profile) and return its id.
 */
export async function createPrincipal(tag: string): Promise<string> {
  const email = uniqueEmail(tag);
  return asService(async (tx) => {
    const [u] = await tx`
      insert into auth.users (id, email, aud, role, created_at, updated_at)
      values (gen_random_uuid(), ${email}, 'authenticated', 'authenticated', now(), now())
      returning id`;
    const id = (u as { id: string }).id;
    await tx`update public.profiles set onboarding_completed_at = now() where id = ${id}`;
    createdUserIds.push(id);
    return id;
  });
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

/** Create a LIVE listing owned by `ownerId`. */
export async function createLiveListing(
  ownerId: string,
  opts: { minNotificationPrice?: number | null; askingPrice?: number } = {},
): Promise<string> {
  const min = opts.minNotificationPrice ?? null;
  return asService(async (tx) => {
    const [l] = await tx`
      insert into public.listings
        (id, owner_id, title, state, version, publication_version, min_notification_price, public_id)
      values
        (gen_random_uuid(), ${ownerId}, 'Integration Test Villa', 'LIVE', 1, 1, ${min},
         'itest-' || substr(gen_random_uuid()::text, 1, 8))
      returning id`;
    const id = (l as { id: string }).id;
    createdListingIds.push(id);
    return id;
  });
}

/** Assert a callback rejects with a message matching `matcher`. */
export async function expectError(fn: () => Promise<unknown>, matcher: RegExp | string): Promise<void> {
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
    if (createdListingIds.length) await tx`delete from public.listings where id in ${tx(createdListingIds)}`;
    if (createdUserIds.length) await tx`delete from auth.users where id in ${tx(createdUserIds)}`;
  });
  createdListingIds.length = 0;
  createdUserIds.length = 0;
}

export async function closePool(): Promise<void> {
  await sql.end({ timeout: 5 });
}
