/** Helpers to drive an offer thread to ACCEPTED and walk a transaction, for Week-5 tests. */
import { asService, asUser, type Sql } from './db';

/** Create an offer (buyer) and accept it (seller); returns the accepted thread id. */
export async function acceptedThread(
  buyer: string,
  seller: string,
  listing: string,
  amount = 2_000_000,
): Promise<string> {
  const threadId = await asUser(buyer, async (tx) => {
    const [t] = await tx`select * from public.create_offer(${listing}::uuid, ${amount}, null)`;
    return (t as { id: string }).id;
  });
  const meta = await asService(
    (tx: Sql) =>
      tx`select current_proposal_id, version from public.offer_threads where id = ${threadId}`,
  );
  const m = meta[0] as { current_proposal_id: string; version: number };
  await asUser(
    seller,
    (tx) =>
      tx`select public.accept_offer(${threadId}::uuid, ${m.current_proposal_id}::uuid, ${m.version})`,
  );
  return threadId;
}

export async function txRow(id: string): Promise<Record<string, any>> {
  return asService(async (tx: Sql) => {
    const [row] = await tx`select * from public.transactions where id = ${id}`;
    return row as Record<string, any>;
  });
}

/** Call a transaction function that returns the transactions row; returns the fresh row.
 * The generic is unconstrained so the postgres tagged-template overloads resolve
 * naturally (a declared array return type breaks that resolution). */
export async function callTx<T>(
  userId: string,
  fnCall: (tx: Sql) => Promise<T>,
): Promise<Record<string, any>> {
  const rows = (await asUser(userId, fnCall)) as unknown as Record<string, any>[];
  return rows[0] as Record<string, any>;
}
