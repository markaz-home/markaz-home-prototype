import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { appRouter, createCallerFactory, type Context } from '@markaz/api';
import { closeConnections, getAppDb } from '@markaz/db';
import { logger } from '@markaz/observability';
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
  console.warn('[profile-contact] skipped — local Postgres not reachable');
}

const createCaller = createCallerFactory(appRouter);

d('optional profile mobile contact', () => {
  let userId = '';
  let email = '';

  beforeAll(async () => {
    const principal = await createNamedPrincipal('profile_contact');
    userId = principal.id;
    email = principal.email;
  });

  afterAll(async () => {
    await cleanup();
    await closePool();
    await closeConnections();
  });

  const caller = () =>
    createCaller({
      db: getAppDb(),
      user: {
        id: userId,
        email,
        accountType: 'CUSTOMER',
        authProviders: ['email'],
      },
      requestId: 'profile-contact-test',
      log: logger,
    } as Context);

  it('normalizes an optional mobile and audits field names without contact values', async () => {
    const profile = await caller().profile.update({
      fullName: 'Updated Customer',
      phone: '050 123 4567',
    });

    expect(profile.fullName).toBe('Updated Customer');
    expect(profile.phoneE164).toBe('+971501234567');
    expect(profile.phoneVerifiedAt).toBeNull();
    expect(profile.phoneVerificationSource).toBeNull();

    const [audit] = await asService(
      (tx) => tx`select metadata from public.audit_events
                 where actor_id = ${userId} and action = 'ACCOUNT_PROFILE_UPDATED'
                 order by created_at desc limit 1`,
    );
    expect((audit as { metadata: { fields: string[] } }).metadata.fields).toEqual([
      'full_name',
      'phone',
    ]);
    expect(JSON.stringify((audit as { metadata: unknown }).metadata)).not.toContain('501234567');
  });

  it('clears prior verification provenance when the contact number changes', async () => {
    await asService(
      (tx) => tx`update public.profiles
                 set phone_verified_at = now(), phone_verification_source = 'UAE_PASS'
                 where id = ${userId}`,
    );

    const profile = await caller().profile.update({
      fullName: 'Updated Customer',
      phone: '+971 55 765 4321',
    });
    expect(profile.phoneE164).toBe('+971557654321');
    expect(profile.phoneVerifiedAt).toBeNull();
    expect(profile.phoneVerificationSource).toBeNull();
  });

  it('blocks direct customer writes outside the trusted API context', async () => {
    const rows = await asUser(
      userId,
      (tx) => tx`update public.profiles
                 set phone_e164 = '+971501111111'
                 where id = ${userId}
                 returning id`,
    );
    expect(rows).toHaveLength(0);
  });
});
