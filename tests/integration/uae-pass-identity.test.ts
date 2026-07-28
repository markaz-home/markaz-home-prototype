import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { appRouter, createCallerFactory, type Context } from '@markaz/api';
import { logger } from '@markaz/observability';
import { getAppDb, closeConnections } from '@markaz/db';
import {
  asService,
  asUser,
  cleanup,
  closePool,
  createNamedPrincipal,
  dbReachable,
} from './helpers/db';

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

  it('confirms auth.identities and records the staging result exactly once', async () => {
    await asService(
      (tx) =>
        tx`insert into auth.identities
             (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
           values
             (${`uae-pass-${userId}`}, ${userId},
              ${tx.json({ sub: `uae-pass-${userId}`, email })},
              'custom:uae-pass', now(), now(), now())`,
    );

    const caller = callerFor(['email', 'custom:uae-pass']);
    const first = await caller.profile.syncUaePassIdentity();
    const second = await caller.profile.syncUaePassIdentity();

    expect(first.identityVerificationStatus).toBe('VERIFIED_STAGING');
    expect(second.identityVerificationStatus).toBe('VERIFIED_STAGING');
    expect(first.onboardingCompletedAt).not.toBeNull();

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
