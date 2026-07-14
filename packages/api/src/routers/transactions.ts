import { randomUUID } from 'node:crypto';
import { and, desc, eq, inArray, or, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
  transactions,
  transactionTasks,
  transactionEvents,
  transactionDocuments,
} from '@markaz/db';
import {
  purchaseRouteSchema,
  financingStatusSchema,
  cancellationReasonSchema,
  transactionDocumentTypeSchema,
  ALLOWED_DOCUMENT_MIME,
  MAX_DOCUMENT_BYTES,
} from '@markaz/domain';
import { transactionDocumentSignedUrl, removeTransactionDocument } from '@markaz/db/storage-admin';
import { router, customerProcedure } from '../trpc';
import {
  toTransactionDetail,
  toTransactionListItem,
  type TaskRow,
  type TxPropertyJson,
  type TxRow,
} from '../transaction-projection';
import type { Tx } from '@markaz/db';

const versioned = z.object({ transactionId: z.string().uuid(), expectedVersion: z.number().int().min(0) });

/** Map SECURITY DEFINER exceptions to safe typed tRPC errors. */
function mapTxError(e: unknown): never {
  const msg = e instanceof Error ? e.message : String(e);
  const code = (m: string) => msg.includes(m);
  if (code('AUTH_REQUIRED')) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'AUTH_REQUIRED' });
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
  const r = await tx.execute(sql`select public.offer_listing_summary(${listingId}::uuid) as j`);
  return (r as unknown as Array<{ j: TxPropertyJson | null }>)[0]?.j ?? null;
}

async function loadTransaction(tx: Tx, transactionId: string): Promise<TxRow | null> {
  const [row] = await tx.select().from(transactions).where(eq(transactions.id, transactionId)).limit(1);
  return (row as unknown as TxRow) ?? null;
}

export const transactionsRouter = router({
  /** Idempotently ensure a transaction exists for an accepted offer thread (spec §7). */
  createFromAcceptedOffer: customerProcedure
    .input(z.object({ offerThreadId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const r = await ctx.tx.execute(sql`select id from public.ensure_transaction(${input.offerThreadId}::uuid)`);
        const id = (r as unknown as Array<{ id: string }>)[0]?.id;
        if (!id) throw new TRPCError({ code: 'NOT_FOUND', message: 'NOT_FOUND' });
        return { transactionId: id };
      } catch (e) {
        if (e instanceof TRPCError) throw e;
        mapTxError(e);
      }
    }),

  /** My Transactions dashboard list (buyer + seller perspective). */
  listMine: customerProcedure.query(async ({ ctx }) => {
    const rows = (await ctx.tx
      .select()
      .from(transactions)
      .where(or(eq(transactions.buyerUserId, ctx.user.id), eq(transactions.sellerUserId, ctx.user.id)))
      .orderBy(desc(transactions.updatedAt))) as unknown as TxRow[];
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    const tasks = (await ctx.tx
      .select()
      .from(transactionTasks)
      .where(inArray(transactionTasks.transactionId, ids))) as unknown as (TaskRow & { transactionId: string })[];
    const out = [];
    for (const row of rows) {
      const property = await propertyFor(ctx.tx, (row as unknown as { listingId: string }).listingId);
      out.push(toTransactionListItem(row, ctx.user.id, property, tasks.filter((t) => t.transactionId === row.id)));
    }
    return out;
  }),

  /** Full perspective-aware workspace detail. Missing == forbidden (safe copy). */
  get: customerProcedure.input(z.object({ transactionId: z.string().uuid() })).query(async ({ ctx, input }) => {
    const row = await loadTransaction(ctx.tx, input.transactionId);
    if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'NOT_AVAILABLE' });
    const listingId = (row as unknown as { listingId: string }).listingId;
    const [tasks, events, docs, property] = await Promise.all([
      ctx.tx.select().from(transactionTasks).where(eq(transactionTasks.transactionId, row.id)).orderBy(transactionTasks.sequence),
      ctx.tx.select().from(transactionEvents).where(eq(transactionEvents.transactionId, row.id)).orderBy(transactionEvents.createdAt),
      ctx.tx.select().from(transactionDocuments).where(eq(transactionDocuments.transactionId, row.id)),
      propertyFor(ctx.tx, listingId),
    ]);
    const allDocs = docs as unknown as { uploadedBy: string }[];
    return toTransactionDetail({
      row,
      userId: ctx.user.id,
      property,
      tasks: tasks as unknown as TaskRow[],
      events: events as never,
      ownDocuments: allDocs.filter((d) => d.uploadedBy === ctx.user.id) as never,
      otherDocuments: allDocs.filter((d) => d.uploadedBy !== ctx.user.id) as never,
    });
  }),

  /** Bell/nav badge — transactions needing this user's action (authoritative task state). */
  getActionCounts: customerProcedure.query(async ({ ctx }) => {
    const rows = (await ctx.tx
      .select({ status: transactions.status, nextActor: transactions.nextActor, buyer: transactions.buyerUserId, seller: transactions.sellerUserId })
      .from(transactions)
      .where(
        and(
          or(eq(transactions.buyerUserId, ctx.user.id), eq(transactions.sellerUserId, ctx.user.id)),
          inArray(transactions.nextActor, ['BUYER', 'SELLER', 'BOTH']),
        ),
      )) as { status: string; nextActor: string; buyer: string; seller: string }[];
    const actionNeeded = rows.filter(
      (t) =>
        t.nextActor === 'BOTH' ||
        (t.buyer === ctx.user.id && t.nextActor === 'BUYER') ||
        (t.seller === ctx.user.id && t.nextActor === 'SELLER'),
    ).length;
    return { actionNeeded };
  }),

  // ---- Mutations (thin wrappers over the SECURITY DEFINER state engine) -----
  confirmDetails: customerProcedure.input(versioned).mutation(({ ctx, input }) =>
    runTask(ctx, input, 'CONFIRM_DETAILS'),
  ),
  reviewSummary: customerProcedure.input(versioned).mutation(({ ctx, input }) => runTask(ctx, input, 'REVIEW_SUMMARY')),
  confirmReadiness: customerProcedure.input(versioned).mutation(({ ctx, input }) =>
    runTask(ctx, input, 'CONFIRM_READINESS'),
  ),
  markDocumentsComplete: customerProcedure.input(versioned).mutation(({ ctx, input }) => runTask(ctx, input, 'DOCUMENTS')),

  selectRoute: customerProcedure
    .input(versioned.extend({ route: purchaseRouteSchema }))
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.tx.execute(
          sql`select public.tx_select_route(${input.transactionId}::uuid, ${input.route}, ${input.expectedVersion})`,
        );
        return { ok: true as const };
      } catch (e) {
        mapTxError(e);
      }
    }),
  setFinancing: customerProcedure
    .input(versioned.extend({ status: financingStatusSchema }))
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.tx.execute(
          sql`select public.tx_set_financing(${input.transactionId}::uuid, ${input.status}, ${input.expectedVersion})`,
        );
        return { ok: true as const };
      } catch (e) {
        mapTxError(e);
      }
    }),
  confirmDeposit: customerProcedure.input(versioned).mutation(async ({ ctx, input }) => {
    try {
      await ctx.tx.execute(sql`select public.tx_confirm_deposit(${input.transactionId}::uuid, ${input.expectedVersion})`);
      return { ok: true as const };
    } catch (e) {
      mapTxError(e);
    }
  }),
  runDueDiligence: customerProcedure.input(versioned).mutation(async ({ ctx, input }) => {
    try {
      await ctx.tx.execute(sql`select public.tx_run_due_diligence(${input.transactionId}::uuid, ${input.expectedVersion})`);
      return { ok: true as const };
    } catch (e) {
      mapTxError(e);
    }
  }),
  proposeTransferDate: customerProcedure
    .input(versioned.extend({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.tx.execute(
          sql`select public.tx_propose_transfer_date(${input.transactionId}::uuid, ${input.date}::date, ${input.expectedVersion})`,
        );
        return { ok: true as const };
      } catch (e) {
        mapTxError(e);
      }
    }),
  createAppointment: customerProcedure.input(versioned).mutation(async ({ ctx, input }) => {
    try {
      await ctx.tx.execute(sql`select public.tx_create_appointment(${input.transactionId}::uuid, ${input.expectedVersion})`);
      return { ok: true as const };
    } catch (e) {
      mapTxError(e);
    }
  }),
  confirmCompletion: customerProcedure.input(versioned).mutation(async ({ ctx, input }) => {
    try {
      await ctx.tx.execute(sql`select public.tx_confirm_completion(${input.transactionId}::uuid, ${input.expectedVersion})`);
      return { ok: true as const };
    } catch (e) {
      mapTxError(e);
    }
  }),
  requestCancellation: customerProcedure
    .input(versioned.extend({ reason: cancellationReasonSchema }))
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.tx.execute(
          sql`select public.tx_request_cancellation(${input.transactionId}::uuid, ${input.reason}, ${input.expectedVersion})`,
        );
        return { ok: true as const };
      } catch (e) {
        mapTxError(e);
      }
    }),
  resolveCancellation: customerProcedure
    .input(versioned.extend({ confirm: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.tx.execute(
          sql`select public.tx_resolve_cancellation(${input.transactionId}::uuid, ${input.confirm}, ${input.expectedVersion})`,
        );
        return { ok: true as const };
      } catch (e) {
        mapTxError(e);
      }
    }),

  // ---- Documents (private, participant-scoped; fictional files only) --------
  /** The storage key a participant must upload to (enforced server-side on register). */
  documentUploadPath: customerProcedure
    .input(z.object({ transactionId: z.string().uuid(), fileName: z.string().min(1).max(200) }))
    .query(({ ctx, input }) => {
      const safe = input.fileName.replace(/[^A-Za-z0-9._-]/g, '_').slice(-80);
      return { path: `${input.transactionId}/${ctx.user.id}/${randomUUID()}-${safe}` };
    }),
  registerDocument: customerProcedure
    .input(
      z.object({
        transactionId: z.string().uuid(),
        documentType: transactionDocumentTypeSchema,
        path: z.string().min(1).max(400),
        fileName: z.string().min(1).max(200),
        mimeType: z.enum(ALLOWED_DOCUMENT_MIME),
        sizeBytes: z.number().int().positive().max(MAX_DOCUMENT_BYTES),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const r = await ctx.tx.execute(
          sql`select id from public.tx_register_document(${input.transactionId}::uuid, ${input.documentType}, ${input.path}, ${input.fileName}, ${input.mimeType}, ${input.sizeBytes})`,
        );
        return { ok: true as const, documentId: (r as unknown as Array<{ id: string }>)[0]?.id };
      } catch (e) {
        mapTxError(e);
      }
    }),
  removeDocument: customerProcedure
    .input(z.object({ transactionId: z.string().uuid(), documentId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Read the path under RLS (uploader-only) before deleting the object.
      const [doc] = (await ctx.tx
        .select({ path: transactionDocuments.storagePath, uploader: transactionDocuments.uploadedBy })
        .from(transactionDocuments)
        .where(eq(transactionDocuments.id, input.documentId))
        .limit(1)) as { path: string; uploader: string }[];
      if (!doc || doc.uploader !== ctx.user.id) throw new TRPCError({ code: 'NOT_FOUND', message: 'NOT_FOUND' });
      try {
        await ctx.tx.execute(
          sql`select public.tx_remove_document(${input.transactionId}::uuid, ${input.documentId}::uuid)`,
        );
        await removeTransactionDocument(doc.path);
        return { ok: true as const };
      } catch (e) {
        mapTxError(e);
      }
    }),
  getDocumentSignedUrl: customerProcedure
    .input(z.object({ documentId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // RLS: a participant can only read their OWN document rows.
      const [doc] = (await ctx.tx
        .select({ path: transactionDocuments.storagePath, uploader: transactionDocuments.uploadedBy, status: transactionDocuments.status })
        .from(transactionDocuments)
        .where(eq(transactionDocuments.id, input.documentId))
        .limit(1)) as { path: string; uploader: string; status: string }[];
      if (!doc || doc.uploader !== ctx.user.id || doc.status === 'REMOVED')
        throw new TRPCError({ code: 'NOT_FOUND', message: 'NOT_AVAILABLE' });
      const url = await transactionDocumentSignedUrl(doc.path, 60);
      if (!url) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'SIGNED_URL_FAILED' });
      return { url };
    }),
});

/** Shared runner for the generic tx_complete_task, resolving the per-side code. */
async function runTask(
  ctx: { tx: Tx; user: { id: string } },
  input: { transactionId: string; expectedVersion: number },
  suffix: 'CONFIRM_DETAILS' | 'REVIEW_SUMMARY' | 'CONFIRM_READINESS' | 'DOCUMENTS',
): Promise<{ ok: true }> {
  try {
    // The buyer/seller code is derived server-side; we pass both and the SQL rejects
    // the one that is not the caller's task (NOT_YOUR_TASK), so try the matching side.
    const [row] = (await ctx.tx
      .select({ buyer: transactions.buyerUserId })
      .from(transactions)
      .where(eq(transactions.id, input.transactionId))
      .limit(1)) as { buyer: string }[];
    if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'NOT_AVAILABLE' });
    const side = row.buyer === ctx.user.id ? 'BUYER' : 'SELLER';
    const code = suffix === 'DOCUMENTS' ? `${side}_DOCUMENTS` : `${side}_${suffix}`;
    await ctx.tx.execute(
      sql`select public.tx_complete_task(${input.transactionId}::uuid, ${code}, ${input.expectedVersion})`,
    );
    return { ok: true as const };
  } catch (e) {
    if (e instanceof TRPCError) throw e;
    mapTxError(e);
  }
}
