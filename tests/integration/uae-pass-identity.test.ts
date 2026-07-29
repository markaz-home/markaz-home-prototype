import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { appRouter, createCallerFactory, type Context } from '@markaz/api';
import { logger } from '@markaz/observability';
import { closeConnections, completeOwnSimulatedIdentity, getAppDb } from '@markaz/db';
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

d('UAE PASS identity outcomes', () => {
  let userId = '';
  let email = '';
  let simulatedUserId = '';
  let simulatedEmail = '';
  let incompleteUserId = '';
  let incompleteEmail = '';

  beforeAll(async () => {
    const principal = await createNamedPrincipal('uae_pass_link');
    userId = principal.id;
    email = principal.email;

    const simulated = await createNamedPrincipal('simulated_identity');
    simulatedUserId = simulated.id;
    simulatedEmail = simulated.email;
    await asService(
      (tx) =>
        tx`update public.profiles
           set full_name = 'Simulated Customer',
               terms_accepted_at = now(),
               privacy_accepted_at = now(),
               onboarding_completed_at = null
           where id = ${simulatedUserId}`,
    );

    const incomplete = await createNamedPrincipal('incomplete_simulated_identity');
    incompleteUserId = incomplete.id;
    incompleteEmail = incomplete.email;
    await asService(
      (tx) =>
        tx`update public.profiles
           set onboarding_completed_at = null
           where id = ${incompleteUserId}`,
    );
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

  it('persists the simulated onboarding outcome exactly once for a complete customer', async () => {
    const first = await completeOwnSimulatedIdentity({
      id: simulatedUserId,
      email: simulatedEmail,
    });
    const second = await completeOwnSimulatedIdentity({
      id: simulatedUserId,
      email: simulatedEmail,
    });

    expect(first?.identityVerificationStatus).toBe('VERIFIED_DEMO');
    expect(second?.identityVerificationStatus).toBe('VERIFIED_DEMO');
    expect(first?.onboardingCompletedAt).not.toBeNull();

    const auditRows = await asService(
      (tx) =>
        tx`select count(*)::int as count
           from public.audit_events
           where actor_id = ${simulatedUserId}
             and action = 'ACCOUNT_IDENTITY_VERIFIED_DEMO'`,
    );
    expect((auditRows[0] as { count: number }).count).toBe(1);
  });

  it('does not complete simulated identity for an incomplete profile', async () => {
    const profile = await completeOwnSimulatedIdentity({
      id: incompleteUserId,
      email: incompleteEmail,
    });

    expect(profile?.identityVerificationStatus).toBe('NOT_STARTED');
    expect(profile?.onboardingCompletedAt).toBeNull();

    const auditRows = await asService(
      (tx) =>
        tx`select count(*)::int as count
           from public.audit_events
           where actor_id = ${incompleteUserId}
             and action = 'ACCOUNT_IDENTITY_VERIFIED_DEMO'`,
    );
    expect((auditRows[0] as { count: number }).count).toBe(0);
  });
});
