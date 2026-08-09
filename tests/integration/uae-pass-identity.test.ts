import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { appRouter, createCallerFactory, type Context } from '@markaz/api';
import { logger } from '@markaz/observability';
import { getAppDb, closeConnections } from '@markaz/db';
import { createClient } from '@supabase/supabase-js';
import {
  asService,
  asUser,
  cleanup,
  closePool,
  createNamedPrincipal,
  dbReachable,
} from './helpers/db';
import { storageEnv } from './helpers/storage';

const reachable = await dbReachable();
const d = reachable ? describe : describe.skip;
if (!reachable) {
  // eslint-disable-next-line no-console
  console.warn('[uae-pass-identity] skipped — local Postgres not reachable');
}

const createCaller = createCallerFactory(appRouter);

d('UAE PASS Staging identity synchronization', () => {
  let userId = '';
  let email = '';

  beforeAll(async () => {
    const principal = await createNamedPrincipal('uae_pass_link');
    userId = principal.id;
    email = principal.email;
  });

  afterAll(async () => {
    await cleanup();
    await closePool();
    await closeConnections();
  });

  const callerFor = (authProviders: string[]) =>
    createCaller({
      db: getAppDb(),
      user: {
        id: userId,
        email,
        accountType: 'CUSTOMER',
        authProviders,
      },
      requestId: 'uae-pass-identity-test',
      log: logger,
    } as Context);

  it('allows both email and first-time UAE PASS account creation', async () => {
    const [emailResult] = await asService(
      (tx) =>
        tx`select public.hook_prevent_unlinked_uae_pass_signup(
          ${tx.json({ user: { app_metadata: { provider: 'email' } } })}::jsonb
        ) as result`,
    );
    const [uaePassResult] = await asService(
      (tx) =>
        tx`select public.hook_prevent_unlinked_uae_pass_signup(
          ${tx.json({ user: { app_metadata: { provider: 'custom:uae-pass' } } })}::jsonb
        ) as result`,
    );
    expect((emailResult as { result: Record<string, unknown> }).result).toEqual({});
    expect((uaePassResult as { result: Record<string, unknown> }).result).toEqual({});
  });

  it('blocks a real password signup before creating a second Auth user', async () => {
    const env = storageEnv();
    if (!env) throw new Error('Local Supabase Auth environment is required for this proof');

    const providerUserId = randomUUID();
    const providerEmail = `uae_pass_duplicate_${providerUserId}@markaz.test`;
    try {
      await asService(async (tx) => {
        await tx`insert into auth.users (
                   id, email, aud, role, raw_app_meta_data, raw_user_meta_data,
                   created_at, updated_at
                 ) values (
                   ${providerUserId}, null, 'authenticated', 'authenticated',
                   ${tx.json({ provider: 'custom:uae-pass', providers: ['custom:uae-pass'] })},
                   ${tx.json({ custom_claims: { email: providerEmail } })},
                   now(), now()
                 )`;
        await tx`update public.profiles
                 set email = ${providerEmail}
                 where id = ${providerUserId}`;
      });

      const client = createClient(env.url, env.anonKey, { auth: { persistSession: false } });
      const { error } = await client.auth.signUp({
        email: providerEmail,
        password: 'Duplicate!Pass1',
      });

      expect(error).toMatchObject({
        status: 422,
        message: 'MARKAZ_ACCOUNT_ALREADY_REGISTERED',
      });

      const [counts] = await asService(
        (tx) =>
          tx`select
            count(*) filter (where u.email is not null)::int as auth_email_users,
            count(distinct p.id)::int as profiles
          from public.profiles p
          join auth.users u on u.id = p.id
          where lower(p.email) = lower(${providerEmail})`,
      );
      expect(counts).toMatchObject({ auth_email_users: 0, profiles: 1 });
    } finally {
      await asService((tx) => tx`delete from auth.users where id = ${providerUserId}`);
    }
  });

  it('exposes the signup hook only to Supabase Auth', async () => {
    const [permissions] = await asService(
      (tx) =>
        tx`select
          has_function_privilege(
            'supabase_auth_admin',
            'public.hook_prevent_unlinked_uae_pass_signup(jsonb)',
            'EXECUTE'
          ) as auth_admin,
          has_function_privilege(
            'authenticated',
            'public.hook_prevent_unlinked_uae_pass_signup(jsonb)',
            'EXECUTE'
          ) as customer,
          has_function_privilege(
            'anon',
            'public.hook_prevent_unlinked_uae_pass_signup(jsonb)',
            'EXECUTE'
          ) as anonymous`,
    );
    expect(permissions).toMatchObject({ auth_admin: true, customer: false, anonymous: false });
  });

  it('keeps the identity-reference table inaccessible to customer and anonymous roles', async () => {
    const [permissions] = await asService(
      (tx) =>
        tx`select
          has_schema_privilege('authenticated', 'private', 'USAGE') as customer_schema,
          has_schema_privilege('anon', 'private', 'USAGE') as anonymous_schema,
          has_table_privilege(
            'authenticated',
            'private.customer_identity_references',
            'SELECT'
          ) as customer_select,
          has_table_privilege(
            'anon',
            'private.customer_identity_references',
            'SELECT'
          ) as anonymous_select`,
    );
    expect(permissions).toMatchObject({
      customer_schema: false,
      anonymous_schema: false,
      customer_select: false,
      anonymous_select: false,
    });
  });

  it('bounds profile synchronization lock waits for callback recovery', async () => {
    const [settings] = await asService(
      (tx) =>
        tx`select proconfig
           from pg_proc
           where oid = 'public.sync_uae_pass_staging_identity()'::regprocedure`,
    );
    expect((settings as { proconfig: string[] }).proconfig).toContain('lock_timeout=2s');
  });

  it('requires the provider-derived session identity and accepts no client verification input', async () => {
    await expect(callerFor([]).profile.syncUaePassIdentity()).rejects.toMatchObject({
      code: 'PRECONDITION_FAILED',
    });
  });

  it('blocks a direct authenticated write to VERIFIED_STAGING', async () => {
    const changed = await asUser(
      userId,
      (tx) =>
        tx`update public.profiles
           set identity_verification_status = 'VERIFIED_STAGING'
           where id = ${userId}
           returning id`,
    );
    expect(changed).toHaveLength(0);
    const [profile] = await asService(
      (tx) =>
        tx`select identity_verification_status::text as status
           from public.profiles
           where id = ${userId}`,
    );
    expect((profile as { status: string }).status).toBe('NOT_STARTED');
  });

  it('projects allow-listed custom claims for an email-less UAE PASS account', async () => {
    const providerUserId = randomUUID();
    const providerEmail = `uae_pass_${providerUserId}@markaz.test`;
    try {
      await asService(async (tx) => {
        await tx`insert into auth.users (
                   id, email, aud, role, raw_app_meta_data, raw_user_meta_data,
                   created_at, updated_at
                 ) values (
                   ${providerUserId}, null, 'authenticated', 'authenticated',
                   ${tx.json({ provider: 'custom:uae-pass', providers: ['custom:uae-pass'] })},
                   ${tx.json({
                     custom_claims: {
                       email: providerEmail,
                       fullnameEN: 'UAE,,,,Pass,,Customer',
                       mobile: '971501112222',
                       uuid: providerUserId,
                       userType: 'SOP3',
                       idn: '784-2000-1234567-1',
                     },
                   })},
                   now(), now()
                 )`;
        await tx`insert into auth.identities
                   (provider_id, user_id, identity_data, provider, last_sign_in_at,
                    created_at, updated_at)
                 values (
                   ${`uae-pass-${providerUserId}`}, ${providerUserId},
                   ${tx.json({
                     sub: `uae-pass-${providerUserId}`,
                     custom_claims: {
                       email: providerEmail,
                       fullnameEN: 'UAE,,,,Pass,,Customer',
                       mobile: '971501112222',
                       uuid: providerUserId,
                       userType: 'SOP3',
                       idn: '784-2000-1234567-1',
                     },
                   })},
                   'custom:uae-pass', now(), now(), now()
                 )`;
      });

      await asUser(providerUserId, (tx) => tx`select public.sync_uae_pass_staging_identity()`);
      const [profile] = await asService(
        (tx) =>
          tx`select email, full_name, phone_e164,
                    phone_verification_source::text as phone_source,
                    identity_verification_status::text as identity_status
             from public.profiles
             where id = ${providerUserId}`,
      );

      expect(profile).toMatchObject({
        email: providerEmail,
        full_name: 'UAE Pass Customer',
        phone_e164: '+971501112222',
        phone_source: 'UAE_PASS',
        identity_status: 'VERIFIED_STAGING',
      });

      const [identityReference] = await asService(
        (tx) =>
          tx`select
            provider,
            emirates_id_hash <> ${'784200012345671'} as is_one_way,
            extensions.crypt(${'784200012345671'}, emirates_id_hash) = emirates_id_hash
              as matches
          from private.customer_identity_references
          where profile_id = ${providerUserId}`,
      );
      expect(identityReference).toMatchObject({
        provider: 'UAE_PASS',
        is_one_way: true,
        matches: true,
      });

      const [publicColumn] = await asService(
        (tx) =>
          tx`select count(*)::int as count
             from information_schema.columns
             where table_schema = 'public'
               and table_name = 'profiles'
               and column_name in ('emirates_id', 'emirates_id_hash', 'idn')`,
      );
      expect((publicColumn as { count: number }).count).toBe(0);
    } finally {
      await asService((tx) => tx`delete from auth.users where id = ${providerUserId}`);
    }
  });

  it('confirms auth.identities and records the staging result exactly once', async () => {
    await asService(
      (tx) =>
        tx`insert into auth.identities
             (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
           values
             (${`uae-pass-${userId}`}, ${userId},
              ${tx.json({
                sub: `uae-pass-${userId}`,
                custom_claims: {
                  uuid: userId,
                  email,
                  fullnameEN: 'Provider Name Must Not Overwrite',
                  mobile: '971501234567',
                  userType: 'SOP3',
                },
              })},
              'custom:uae-pass', now(), now(), now())`,
    );

    const caller = callerFor(['email', 'custom:uae-pass']);
    const first = await caller.profile.syncUaePassIdentity();
    const second = await caller.profile.syncUaePassIdentity();

    expect(first.identityVerificationStatus).toBe('VERIFIED_STAGING');
    expect(second.identityVerificationStatus).toBe('VERIFIED_STAGING');
    expect(first.onboardingCompletedAt).not.toBeNull();
    expect(first.fullName).toBe('Integration uae_pass_link');
    expect(first.phoneE164).toBe('+971501234567');
    expect(first.phoneVerificationSource).toBe('UAE_PASS');

    const auditRows = await asService(
      (tx) =>
        tx`select count(*)::int as count
           from public.audit_events
           where actor_id = ${userId}
             and action = 'UAE_PASS_STAGING_IDENTITY_LINKED'`,
    );
    expect((auditRows[0] as { count: number }).count).toBe(1);
  });
});
