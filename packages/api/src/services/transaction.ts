import { randomUUID } from 'node:crypto';
import { and, desc, eq, inArray, or, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import {
  transactions,
  transactionTasks,
  transactionEvents,
  transactionDocuments,
  execRow,
  execRows,
  type Tx,
} from '@markaz/db';
import {
  type PurchaseRoute,
  type FinancingStatus,
  type CancellationReason,
  type TransactionDocumentType,
} from '@markaz/domain';
import { transactionDocumentSignedUrl, removeTransactionDocument } from '@markaz/db/storage-admin';
import {
  toTransactionDetail,
  toTransactionListItem,
  type TaskRow,
  type TxPropertyJson,
  type TxRow,
} from '../transaction-projection';

/** Map SECURITY DEFINER exceptions to safe typed tRPC errors. */
function mapTxError(e: unknown): never {
  const msg = e instanceof Error ? e.message : String(e);
  const code = (m: string) => msg.includes(m);
  if (code('AUTH_REQUIRED'))
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'AUTH_REQUIRED' });
  if (code('NOT_FOUND')) throw new TRPCError({ code: 'NOT_FOUND', message: 'NOT_FOUND' });
  if (code('STALE') || code('23505')) throw new TRPCError({ code: 'CONFLICT', message: 'STALE' });
  if (code('NOT_YOUR_TASK') || code('insufficient_privilege') || code('permission denied'))
    throw new TRPCError({ code: 'FORBIDDEN', message: 'NOT_YOUR_TASK' });
  for (const c of [
    'TERMINAL',
    'NOT_ACTIONABLE',
    'NOT_ACCEPTED',
    'INVALID_DATE',
    'NOT_READY',
    'ALREADY_PENDING',
    'CANCELLATION_PENDING',
    'ROUTE_LOCKED',
    'INVALID_TASK',
  ]) {
    if (code(c)) throw new TRPCError({ code: 'BAD_REQUEST', message: c });
  }
  throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'TRANSACTION_ERROR' });
}

async function propertyFor(tx: Tx, listingId: string): Promise<TxPropertyJson | null> {
  const row = await execRow<{ j: TxPropertyJson | null }>(
    tx,
    sql`select public.offer_listing_summary(${listingId}::uuid) as j`,
  );
  return row?.j ?? null;
}

/**
 * Batch-load the property summary for many listings in ONE round-trip (avoids the
 * per-row N+1 that `listMine` previously incurred). Runs inside the caller's RLS
 * transaction, so `offer_listing_summary` still authorises via `auth.uid()`.
 */
async function propertiesFor(
  tx: Tx,
  listingIds: string[],
): Promise<Map<string, TxPropertyJson | null>> {
  const map = new Map<string, TxPropertyJson | null>();
  if (listingIds.length === 0) return map;
  const idParams = sql.join(
    listingIds.map((id) => sql`${id}::uuid`),
    sql`, `,
  );
  const rows = await execRows<{ listing_id: string; j: TxPropertyJson | null }>(
    tx,
    sql`
      select t.id::text as listing_id, public.offer_listing_summary(t.id) as j
      from unnest(array[${idParams}]) as t(id)
    `,
  );
  for (const r of rows) map.set(r.listing_id, r.j ?? null);
  return map;
}

async function loadTransaction(tx: Tx, transactionId: string): Promise<TxRow | null> {
  const [row] = await tx
    .select()
    .from(transactions)
    .where(eq(transactions.id, transactionId))
    .limit(1);
  return (row as unknown as TxRow) ?? null;
}

/** Shared runner for the generic tx_complete_task, resolving the per-side code. */
async function runTask(
  tx: Tx,
  userId: string,
  input: { transactionId: string; expectedVersion: number },
  suffix: 'CONFIRM_DETAILS' | 'REVIEW_SUMMARY' | 'CONFIRM_READINESS' | 'DOCUMENTS',
): Promise<{ ok: true }> {
  try {
    // The buyer/seller code is derived server-side; we pass both and the SQL rejects
    // the one that is not the caller's task (NOT_YOUR_TASK), so try the matching side.
    const [row] = (await tx
      .select({ buyer: transactions.buyerUserId })
      .from(transactions)
      .where(eq(transactions.id, input.transactionId))
      .limit(1)) as { buyer: string }[];
    if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'NOT_AVAILABLE' });
    const side = row.buyer === userId ? 'BUYER' : 'SELLER';
    const code = suffix === 'DOCUMENTS' ? `${side}_DOCUMENTS` : `${side}_${suffix}`;
    await tx.execute(
      sql`select public.tx_complete_task(${input.transactionId}::uuid, ${code}, ${input.expectedVersion})`,
    );
    return { ok: true as const };
  } catch (e) {
    if (e instanceof TRPCError) throw e;
    mapTxError(e);
  }
}

/**
 * Transaction workspace orchestration (spec §7). Read orchestration + write
 * coordination over the `public.tx_*` SECURITY DEFINER state engine. Each write
 * method throws typed tRPC errors via `mapTxError`, so the router is a thin
 * adapter with no try/catch of its own.
 */
export const TransactionService = {
  /** Idempotently ensure a transaction exists for an accepted offer thread (spec §7). */
  async ensureFromAcceptedOffer(tx: Tx, offerThreadId: string): Promise<{ transactionId: string }> {
    try {
      const row = await execRow<{ id: string }>(
        tx,
        sql`select id from public.ensure_transaction(${offerThreadId}::uuid)`,
      );
      const id = row?.id;
      if (!id) throw new TRPCError({ code: 'NOT_FOUND', message: 'NOT_FOUND' });
      return { transactionId: id };
    } catch (e) {
      if (e instanceof TRPCError) throw e;
      mapTxError(e);
    }
  },

  /** My Transactions dashboard list (buyer + seller perspective). */
  async listMine(tx: Tx, userId: string) {
    const rows = (await tx
      .select()
      .from(transactions)
      .where(or(eq(transactions.buyerUserId, userId), eq(transactions.sellerUserId, userId)))
      .orderBy(desc(transactions.updatedAt))) as unknown as TxRow[];
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    const tasks = (await tx
      .select()
      .from(transactionTasks)
      .where(inArray(transactionTasks.transactionId, ids))) as unknown as (TaskRow & {
      transactionId: string;
    })[];
    const propertyByListing = await propertiesFor(tx, [...new Set(rows.map((r) => r.listingId))]);
    return rows.map((row) =>
      toTransactionListItem(
        row,
        userId,
        propertyByListing.get(row.listingId) ?? null,
        tasks.filter((t) => t.transactionId === row.id),
      ),
    );
  },

  /** Full perspective-aware workspace detail. Missing == forbidden (safe copy). */
  async getDetail(tx: Tx, userId: string, transactionId: string) {
    const row = await loadTransaction(tx, transactionId);
    if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'NOT_AVAILABLE' });
    const listingId = row.listingId;
    const [tasks, events, docs, property] = await Promise.all([
      tx
        .select()
        .from(transactionTasks)
        .where(eq(transactionTasks.transactionId, row.id))
        .orderBy(transactionTasks.sequence),
      tx
        .select()
        .from(transactionEvents)
        .where(eq(transactionEvents.transactionId, row.id))
        .orderBy(transactionEvents.createdAt),
      tx.select().from(transactionDocuments).where(eq(transactionDocuments.transactionId, row.id)),
      propertyFor(tx, listingId),
    ]);
    const allDocs = docs as unknown as { uploadedBy: string }[];
    return toTransactionDetail({
      row,
      userId,
      property,
      tasks: tasks as unknown as TaskRow[],
      events: events as never,
      ownDocuments: allDocs.filter((d) => d.uploadedBy === userId) as never,
      otherDocuments: allDocs.filter((d) => d.uploadedBy !== userId) as never,
    });
  },

  /** Bell/nav badge — transactions needing this user's action (authoritative task state). */
  async getActionCounts(tx: Tx, userId: string) {
    const rows = (await tx
      .select({
        status: transactions.status,
        nextActor: transactions.nextActor,
        buyer: transactions.buyerUserId,
        seller: transactions.sellerUserId,
      })
      .from(transactions)
      .where(
        and(
          or(eq(transactions.buyerUserId, userId), eq(transactions.sellerUserId, userId)),
          inArray(transactions.nextActor, ['BUYER', 'SELLER', 'BOTH']),
        ),
      )) as { status: string; nextActor: string; buyer: string; seller: string }[];
    const actionNeeded = rows.filter(
      (t) =>
        t.nextActor === 'BOTH' ||
        (t.buyer === userId && t.nextActor === 'BUYER') ||
        (t.seller === userId && t.nextActor === 'SELLER'),
    ).length;
    return { actionNeeded };
  },

  // ---- Task completions (thin wrappers over the generic runner) -------------
  completeTask(
    tx: Tx,
    userId: string,
    input: { transactionId: string; expectedVersion: number },
    suffix: 'CONFIRM_DETAILS' | 'REVIEW_SUMMARY' | 'CONFIRM_READINESS' | 'DOCUMENTS',
  ): Promise<{ ok: true }> {
    return runTask(tx, userId, input, suffix);
  },

  // ---- Mutations (thin wrappers over the SECURITY DEFINER state engine) -----
  async selectRoute(
    tx: Tx,
    input: { transactionId: string; expectedVersion: number; route: PurchaseRoute },
  ) {
    try {
      await tx.execute(
        sql`select public.tx_select_route(${input.transactionId}::uuid, ${input.route}, ${input.expectedVersion})`,
      );
      return { ok: true as const };
    } catch (e) {
      mapTxError(e);
    }
  },

  async setFinancing(
    tx: Tx,
    input: { transactionId: string; expectedVersion: number; status: FinancingStatus },
  ) {
    try {
      await tx.execute(
        sql`select public.tx_set_financing(${input.transactionId}::uuid, ${input.status}, ${input.expectedVersion})`,
      );
      return { ok: true as const };
    } catch (e) {
      mapTxError(e);
    }
  },

  async confirmDeposit(tx: Tx, input: { transactionId: string; expectedVersion: number }) {
    try {
      await tx.execute(
        sql`select public.tx_confirm_deposit(${input.transactionId}::uuid, ${input.expectedVersion})`,
      );
      return { ok: true as const };
    } catch (e) {
      mapTxError(e);
    }
  },

  async runDueDiligence(tx: Tx, input: { transactionId: string; expectedVersion: number }) {
    try {
      await tx.execute(
        sql`select public.tx_run_due_diligence(${input.transactionId}::uuid, ${input.expectedVersion})`,
      );
      return { ok: true as const };
    } catch (e) {
      mapTxError(e);
    }
  },

  async proposeTransferDate(
    tx: Tx,
    input: { transactionId: string; expectedVersion: number; date: string },
  ) {
    try {
      await tx.execute(
        sql`select public.tx_propose_transfer_date(${input.transactionId}::uuid, ${input.date}::date, ${input.expectedVersion})`,
      );
      return { ok: true as const };
    } catch (e) {
      mapTxError(e);
    }
  },

  async createAppointment(tx: Tx, input: { transactionId: string; expectedVersion: number }) {
    try {
      await tx.execute(
        sql`select public.tx_create_appointment(${input.transactionId}::uuid, ${input.expectedVersion})`,
      );
      return { ok: true as const };
    } catch (e) {
      mapTxError(e);
    }
  },

  async confirmCompletion(tx: Tx, input: { transactionId: string; expectedVersion: number }) {
    try {
      await tx.execute(
        sql`select public.tx_confirm_completion(${input.transactionId}::uuid, ${input.expectedVersion})`,
      );
      return { ok: true as const };
    } catch (e) {
      mapTxError(e);
    }
  },

  async requestCancellation(
    tx: Tx,
    input: { transactionId: string; expectedVersion: number; reason: CancellationReason },
  ) {
    try {
      await tx.execute(
        sql`select public.tx_request_cancellation(${input.transactionId}::uuid, ${input.reason}, ${input.expectedVersion})`,
      );
      return { ok: true as const };
    } catch (e) {
      mapTxError(e);
    }
  },

  async resolveCancellation(
    tx: Tx,
    input: { transactionId: string; expectedVersion: number; confirm: boolean },
  ) {
    try {
      await tx.execute(
        sql`select public.tx_resolve_cancellation(${input.transactionId}::uuid, ${input.confirm}, ${input.expectedVersion})`,
      );
      return { ok: true as const };
    } catch (e) {
      mapTxError(e);
    }
  },

  // ---- Documents (private, participant-scoped; fictional files only) --------
  /** The storage key a participant must upload to (enforced server-side on register). */
  documentUploadPath(userId: string, transactionId: string, fileName: string): { path: string } {
    const safe = fileName.replace(/[^A-Za-z0-9._-]/g, '_').slice(-80);
    return { path: `${transactionId}/${userId}/${randomUUID()}-${safe}` };
  },

  async registerDocument(
    tx: Tx,
    input: {
      transactionId: string;
      documentType: TransactionDocumentType;
      path: string;
      fileName: string;
      mimeType: string;
      sizeBytes: number;
    },
  ) {
    try {
      const row = await execRow<{ id: string }>(
        tx,
        sql`select id from public.tx_register_document(${input.transactionId}::uuid, ${input.documentType}, ${input.path}, ${input.fileName}, ${input.mimeType}, ${input.sizeBytes})`,
      );
      return { ok: true as const, documentId: row?.id };
    } catch (e) {
      mapTxError(e);
    }
  },

  async removeDocument(
    tx: Tx,
    userId: string,
    input: { transactionId: string; documentId: string },
  ) {
    // Read the path under RLS (uploader-only) before deleting the object.
    const [doc] = (await tx
      .select({
        path: transactionDocuments.storagePath,
        uploader: transactionDocuments.uploadedBy,
      })
      .from(transactionDocuments)
      .where(eq(transactionDocuments.id, input.documentId))
      .limit(1)) as { path: string; uploader: string }[];
    if (!doc || doc.uploader !== userId)
      throw new TRPCError({ code: 'NOT_FOUND', message: 'NOT_FOUND' });
    try {
      await tx.execute(
        sql`select public.tx_remove_document(${input.transactionId}::uuid, ${input.documentId}::uuid)`,
      );
      await removeTransactionDocument(doc.path);
      return { ok: true as const };
    } catch (e) {
      mapTxError(e);
    }
  },

  async getDocumentSignedUrl(tx: Tx, userId: string, input: { documentId: string }) {
    // RLS: a participant can only read their OWN document rows.
    const [doc] = (await tx
      .select({
        path: transactionDocuments.storagePath,
        uploader: transactionDocuments.uploadedBy,
        status: transactionDocuments.status,
      })
      .from(transactionDocuments)
      .where(eq(transactionDocuments.id, input.documentId))
      .limit(1)) as { path: string; uploader: string; status: string }[];
    if (!doc || doc.uploader !== userId || doc.status === 'REMOVED')
      throw new TRPCError({ code: 'NOT_FOUND', message: 'NOT_AVAILABLE' });
    const url = await transactionDocumentSignedUrl(doc.path, 60);
    if (!url) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'SIGNED_URL_FAILED' });
    return { url };
  },
};
