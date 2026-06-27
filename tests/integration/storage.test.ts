import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { sql } from 'drizzle-orm';
import { withUserContext, withAnonContext, closeConnections, getDirectDb } from '@markaz/db';
import { getAppDb, dbAvailableAndSeeded, IDS } from './helpers';

/**
 * Storage boundary proof (Step 16) at the database/RLS layer:
 * private ownership-documents are owner/admin only; public listing-photos are
 * world-readable. Uses only fictional sample object paths.
 */
let available = false;
const PRIVATE_OBJ = 'integration/title-deed-sample.pdf';
const PUBLIC_OBJ = 'integration/listing-cover.jpg';

beforeAll(async () => {
  available = await dbAvailableAndSeeded();
  if (!available) return;
  // Clean any prior run.
  await getDirectDb().execute(
    sql`delete from storage.objects where name in (${PRIVATE_OBJ}, ${PUBLIC_OBJ})`,
  );
});
afterAll(async () => {
  if (available) {
    await getDirectDb().execute(
      sql`delete from storage.objects where name in (${PRIVATE_OBJ}, ${PUBLIC_OBJ})`,
    );
  }
  await closeConnections();
});

const asA = (fn: Parameters<typeof withUserContext>[2]) =>
  withUserContext(getAppDb(), { userId: IDS.customerA, accountType: 'CUSTOMER' }, fn);
const asB = (fn: Parameters<typeof withUserContext>[2]) =>
  withUserContext(getAppDb(), { userId: IDS.customerB, accountType: 'CUSTOMER' }, fn);
const asAdmin = (fn: Parameters<typeof withUserContext>[2]) =>
  withUserContext(getAppDb(), { userId: IDS.admin, accountType: 'ADMIN' }, fn);

function rows(r: unknown): unknown[] {
  return r as unknown[];
}

describe('storage RLS boundary', () => {
  it('owner can upload a private object; unrelated customer cannot read it', async () => {
    if (!available) return;
    await asA((tx) =>
      tx.execute(
        sql`insert into storage.objects (bucket_id, name, owner) values ('ownership-documents', ${PRIVATE_OBJ}, ${IDS.customerA})`,
      ),
    );

    const ownerSees = await asA((tx) =>
      tx.execute(sql`select name from storage.objects where name = ${PRIVATE_OBJ}`),
    );
    expect(rows(ownerSees)).toHaveLength(1);

    const otherSees = await asB((tx) =>
      tx.execute(sql`select name from storage.objects where name = ${PRIVATE_OBJ}`),
    );
    expect(rows(otherSees)).toHaveLength(0);

    const anonSees = await withAnonContext(getAppDb(), (tx) =>
      tx.execute(sql`select name from storage.objects where name = ${PRIVATE_OBJ}`),
    );
    expect(rows(anonSees)).toHaveLength(0);

    const adminSees = await asAdmin((tx) =>
      tx.execute(sql`select name from storage.objects where name = ${PRIVATE_OBJ}`),
    );
    expect(rows(adminSees)).toHaveLength(1);
  });

  it('public listing photos are world-readable', async () => {
    if (!available) return;
    await asA((tx) =>
      tx.execute(
        sql`insert into storage.objects (bucket_id, name, owner) values ('listing-photos', ${PUBLIC_OBJ}, ${IDS.customerA})`,
      ),
    );
    const anonSees = await withAnonContext(getAppDb(), (tx) =>
      tx.execute(sql`select name from storage.objects where name = ${PUBLIC_OBJ}`),
    );
    expect(rows(anonSees)).toHaveLength(1);
  });

  it('bucket visibility flags are correct', async () => {
    if (!available) return;
    const r = await getDirectDb().execute(
      sql`select id, public from storage.buckets where id in ('ownership-documents','listing-photos') order by id`,
    );
    const list = r as unknown as Array<{ id: string; public: boolean }>;
    expect(list.find((b) => b.id === 'ownership-documents')?.public).toBe(false);
    expect(list.find((b) => b.id === 'listing-photos')?.public).toBe(true);
  });
});
