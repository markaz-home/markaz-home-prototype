import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  asAnon,
  asService,
  asTrustedUser,
  asUser,
  cleanup,
  closePool,
  createListing,
  createPrincipal,
  dbReachable,
  expectError,
} from './helpers/db';

const reachable = await dbReachable();
const d = reachable ? describe : describe.skip;
if (!reachable) {
  // eslint-disable-next-line no-console
  console.warn('[security-boundary] skipped — local Postgres not reachable');
}

d('direct REST/RPC security boundary', () => {
  let seller = '';
  let buyer = '';
  let draft = '';
  let live = '';

  beforeAll(async () => {
    seller = await createPrincipal('boundary_seller');
    buyer = await createPrincipal('boundary_buyer');
    draft = await createListing(seller, { state: 'DRAFT' });
    live = await createListing(seller, {
      state: 'LIVE',
      askingPrice: 2_000_000,
      minNotificationPrice: 1_500_000,
    });
  });

  afterAll(async () => {
    await cleanup();
    await closePool();
  });

  it('blocks direct profile identity/onboarding forgery', async () => {
    const rows = await asUser(
      seller,
      (tx) =>
        tx`update public.profiles
           set identity_verification_status = 'VERIFIED_DEMO',
               onboarding_completed_at = now()
           where id = ${seller}
           returning id`,
    );
    expect(rows).toHaveLength(0);

    const [profile] = await asService(
      (tx) =>
        tx`select identity_verification_status::text as status
           from public.profiles where id = ${seller}`,
    );
    expect((profile as { status: string }).status).toBe('NOT_STARTED');
  });

  it('blocks direct listing and publication workflow forgery', async () => {
    const listingRows = await asUser(
      seller,
      (tx) =>
        tx`update public.listings
           set state = 'LIVE', public_id = 'forged-public-id'
           where id = ${draft}
           returning id`,
    );
    expect(listingRows).toHaveLength(0);

    const requestId = await asService(async (tx) => {
      const [row] = await tx`
        insert into public.listing_publication_requests
          (listing_id, seller_user_id, status, submitted_at)
        values (${draft}, ${seller}, 'PENDING', now())
        returning id`;
      return (row as { id: string }).id;
    });
    const requestRows = await asUser(
      seller,
      (tx) =>
        tx`update public.listing_publication_requests
           set status = 'APPROVED_DEMO', resolved_at = now()
           where id = ${requestId}
           returning id`,
    );
    expect(requestRows).toHaveLength(0);
  });

  it('allows the same owner mutation through the trusted API context', async () => {
    const rows = await asTrustedUser(
      seller,
      (tx) =>
        tx`update public.listings
           set title = 'Trusted API update'
           where id = ${draft}
           returning title`,
    );
    expect((rows[0] as { title: string }).title).toBe('Trusted API update');
  });

  it('blocks customer-forged audit rows', async () => {
    await expectError(
      () =>
        asUser(
          seller,
          (tx) =>
            tx`insert into public.audit_events
                 (actor_id, action, entity_type, entity_id, metadata)
               values
                 (${seller}, 'ADMIN_LISTING_PAUSED', 'listing', ${draft}, '{"result":"forged"}')`,
        ),
      /row-level security|policy|permission/i,
    );
  });

  it('keeps internal transaction and private-threshold helpers off the RPC surface', async () => {
    await expectError(
      () =>
        asAnon(
          (tx) =>
            tx`select public.tx_finalize_cancellation(
              '00000000-0000-0000-0000-000000000001'::uuid,
              'forged',
              'BUYER'
            )`,
        ),
      /permission denied/i,
    );
    await expectError(
      () => asUser(buyer, (tx) => tx`select public.offer_below_threshold(${live}::uuid, 1000000)`),
      /permission denied/i,
    );
    await expectError(
      () => asUser(buyer, (tx) => tx`select public.tx_recompute(${live}::uuid)`),
      /permission denied/i,
    );
  });

  it('does not expose the seller threshold to a participating buyer', async () => {
    await asUser(
      buyer,
      (tx) => tx`select id from public.create_offer(${live}::uuid, 1600000, null)`,
    );
    const [row] = await asUser(
      buyer,
      (tx) => tx`select public.offer_listing_summary(${live}::uuid) as summary`,
    );
    const summary = (row as { summary: { minNotificationPrice: string | null } }).summary;
    expect(summary.minNotificationPrice).toBeNull();
  });

  it('blocks direct close_listing_offers even for the listing owner', async () => {
    await expectError(
      () =>
        asUser(
          seller,
          (tx) => tx`select public.close_listing_offers(${live}::uuid, 'LISTING_PAUSED')`,
        ),
      /TRUSTED_API_REQUIRED|permission denied/i,
    );
  });
});
