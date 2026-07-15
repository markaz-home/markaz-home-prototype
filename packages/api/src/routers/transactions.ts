import { z } from 'zod';
import {
  purchaseRouteSchema,
  financingStatusSchema,
  cancellationReasonSchema,
  transactionDocumentTypeSchema,
  ALLOWED_DOCUMENT_MIME,
  MAX_DOCUMENT_BYTES,
} from '@markaz/domain';
import { router, customerProcedure } from '../trpc';
import { TransactionService } from '../services/transaction';

const versioned = z.object({
  transactionId: z.string().uuid(),
  expectedVersion: z.number().int().min(0),
});

export const transactionsRouter = router({
  /** Idempotently ensure a transaction exists for an accepted offer thread (spec §7). */
  createFromAcceptedOffer: customerProcedure
    .input(z.object({ offerThreadId: z.string().uuid() }))
    .mutation(({ ctx, input }) =>
      TransactionService.ensureFromAcceptedOffer(ctx.tx, input.offerThreadId),
    ),

  /** My Transactions dashboard list (buyer + seller perspective). */
  listMine: customerProcedure.query(({ ctx }) => TransactionService.listMine(ctx.tx, ctx.user.id)),

  /** Full perspective-aware workspace detail. Missing == forbidden (safe copy). */
  get: customerProcedure
    .input(z.object({ transactionId: z.string().uuid() }))
    .query(({ ctx, input }) =>
      TransactionService.getDetail(ctx.tx, ctx.user.id, input.transactionId),
    ),

  /** Bell/nav badge — transactions needing this user's action (authoritative task state). */
  getActionCounts: customerProcedure.query(({ ctx }) =>
    TransactionService.getActionCounts(ctx.tx, ctx.user.id),
  ),

  // ---- Mutations (thin wrappers over the SECURITY DEFINER state engine) -----
  confirmDetails: customerProcedure
    .input(versioned)
    .mutation(({ ctx, input }) =>
      TransactionService.completeTask(ctx.tx, ctx.user.id, input, 'CONFIRM_DETAILS'),
    ),
  reviewSummary: customerProcedure
    .input(versioned)
    .mutation(({ ctx, input }) =>
      TransactionService.completeTask(ctx.tx, ctx.user.id, input, 'REVIEW_SUMMARY'),
    ),
  confirmReadiness: customerProcedure
    .input(versioned)
    .mutation(({ ctx, input }) =>
      TransactionService.completeTask(ctx.tx, ctx.user.id, input, 'CONFIRM_READINESS'),
    ),
  markDocumentsComplete: customerProcedure
    .input(versioned)
    .mutation(({ ctx, input }) =>
      TransactionService.completeTask(ctx.tx, ctx.user.id, input, 'DOCUMENTS'),
    ),

  selectRoute: customerProcedure
    .input(versioned.extend({ route: purchaseRouteSchema }))
    .mutation(({ ctx, input }) => TransactionService.selectRoute(ctx.tx, input)),
  setFinancing: customerProcedure
    .input(versioned.extend({ status: financingStatusSchema }))
    .mutation(({ ctx, input }) => TransactionService.setFinancing(ctx.tx, input)),
  confirmDeposit: customerProcedure
    .input(versioned)
    .mutation(({ ctx, input }) => TransactionService.confirmDeposit(ctx.tx, input)),
  runDueDiligence: customerProcedure
    .input(versioned)
    .mutation(({ ctx, input }) => TransactionService.runDueDiligence(ctx.tx, input)),
  proposeTransferDate: customerProcedure
    .input(versioned.extend({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
    .mutation(({ ctx, input }) => TransactionService.proposeTransferDate(ctx.tx, input)),
  createAppointment: customerProcedure
    .input(versioned)
    .mutation(({ ctx, input }) => TransactionService.createAppointment(ctx.tx, input)),
  confirmCompletion: customerProcedure
    .input(versioned)
    .mutation(({ ctx, input }) => TransactionService.confirmCompletion(ctx.tx, input)),
  requestCancellation: customerProcedure
    .input(versioned.extend({ reason: cancellationReasonSchema }))
    .mutation(({ ctx, input }) => TransactionService.requestCancellation(ctx.tx, input)),
  resolveCancellation: customerProcedure
    .input(versioned.extend({ confirm: z.boolean() }))
    .mutation(({ ctx, input }) => TransactionService.resolveCancellation(ctx.tx, input)),

  // ---- Documents (private, participant-scoped; fictional files only) --------
  /** The storage key a participant must upload to (enforced server-side on register). */
  documentUploadPath: customerProcedure
    .input(z.object({ transactionId: z.string().uuid(), fileName: z.string().min(1).max(200) }))
    .query(({ ctx, input }) =>
      TransactionService.documentUploadPath(ctx.user.id, input.transactionId, input.fileName),
    ),
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
    .mutation(({ ctx, input }) => TransactionService.registerDocument(ctx.tx, input)),
  removeDocument: customerProcedure
    .input(z.object({ transactionId: z.string().uuid(), documentId: z.string().uuid() }))
    .mutation(({ ctx, input }) => TransactionService.removeDocument(ctx.tx, ctx.user.id, input)),
  getDocumentSignedUrl: customerProcedure
    .input(z.object({ documentId: z.string().uuid() }))
    .query(({ ctx, input }) => TransactionService.getDocumentSignedUrl(ctx.tx, ctx.user.id, input)),
});
