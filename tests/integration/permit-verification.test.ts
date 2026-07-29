import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  asAnon,
  asService,
  cleanup,
  closePool,
  createListing,
  createPrincipal,
  dbReachable,
} from './helpers/db';

const reachable = await dbReachable();
const d = reachable ? describe : describe.skip;
if (!reachable) {
  // eslint-disable-next-line no-console
  console.warn('[permit-verification] skipped — local Postgres not reachable');
}

let ownerId = '';
const permitNumber = 'DEMO-TRK-PRIVACY1';

beforeAll(async () => {
  if (reachable) ownerId = await createPrincipal('permit');
});

afterAll(async () => {
  if (reachable) {
    await cleanup();
    await closePool();
  }
});

d('public permit verification', () => {
  it('confirms validity without exposing non-LIVE property metadata', async () => {
    const listingId = await createListing(ownerId, { state: 'READY_TO_PUBLISH' });
    await asService(async (tx) => {
      const [property] = await tx`
        insert into public.properties
          (owner_id, emirate, community, property_type, building_or_project, unit_identifier)
        values
          (${ownerId}, 'DUBAI', 'Dubai Marina', 'APARTMENT', 'Private Tower', 'Unit 909')
        returning id`;
      const propertyId = (property as { id: string }).id;
      await tx`update public.listings set property_id = ${propertyId} where id = ${listingId}`;
      await tx`
        insert into public.permit_records
          (listing_id, status, permit_number, approved_at)
        values
          (${listingId}, 'VERIFIED_DEMO', ${permitNumber}, now())`;
    });

    const [unpublished] = await asAnon(
      (tx) => tx`select * from public.permit_verification(${permitNumber})`,
    );
    expect(unpublished).toMatchObject({
      permit_number: permitNumber,
      listing_is_live: false,
      property_type: null,
      community: null,
      building_or_project: null,
      emirate: null,
      listing_public_id: null,
      listing_slug: null,
    });
    expect(JSON.stringify(unpublished)).not.toContain('Unit 909');
    expect(JSON.stringify(unpublished)).not.toContain('Private Tower');

    await asService(
      (tx) => tx`
        update public.listings
        set state = 'LIVE', public_id = 'permit-public-1', public_slug = 'marina-apartment'
        where id = ${listingId}`,
    );

    const [published] = await asAnon(
      (tx) => tx`select * from public.permit_verification(${permitNumber.toLowerCase()})`,
    );
    expect(published).toMatchObject({
      listing_is_live: true,
      property_type: 'APARTMENT',
      community: 'Dubai Marina',
      building_or_project: 'Private Tower',
      emirate: 'DUBAI',
      listing_public_id: 'permit-public-1',
      listing_slug: 'marina-apartment',
    });
    expect(JSON.stringify(published)).not.toContain('Unit 909');
  });

  it('rejects duplicate active permit references and bounds direct RPC input', async () => {
    const otherListing = await createListing(ownerId, { state: 'READY_TO_PUBLISH' });
    await expect(
      asService(
        (tx) => tx`
          insert into public.permit_records
            (listing_id, status, permit_number, approved_at)
          values
            (${otherListing}, 'VERIFIED_DEMO', ${permitNumber.toLowerCase()}, now())`,
      ),
    ).rejects.toThrow();

    const tooLong = await asAnon(
      (tx) => tx`select * from public.permit_verification(${'x'.repeat(65)})`,
    );
    expect(tooLong).toEqual([]);
  });
});
