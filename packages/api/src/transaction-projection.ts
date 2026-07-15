/**
 * Week-5 transaction DTO projection — explicit allow-list mapping (spec §42).
 * Never spread a DB row; every field is chosen. No participant identity/contact, no
 * storage paths, no other participant's private files, no raw internal ids in copy.
 */
import {
  completedStageCount,
  computeProgress,
  isBuyerDocumentType,
  nextActorKey,
  stageIndex,
  taskOwnershipKey,
  TRANSACTION_STAGES,
  transactionStatusKey,
  type Perspective,
  type TransactionActor,
  type TransactionNextActor,
  type TransactionStatus,
  type TransactionTaskStatus,
} from '@markaz/domain';
import { publicPhotoUrl } from './public-projection';

export interface TxPropertyJson {
  publicId: string | null;
  slug?: string | null;
  headline?: string | null;
  askingPrice?: number | string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  community?: string | null;
  emirate?: string | null;
  propertyType?: string | null;
  buildingOrProject?: string | null;
  coverPublicPath?: string | null;
}

export function mapProperty(p: TxPropertyJson | null) {
  if (!p) return null;
  const headline =
    p.headline ?? [p.buildingOrProject, p.community].filter(Boolean).join(' · ') ?? 'Property';
  return {
    publicId: p.publicId ?? null,
    slug: p.slug ?? null,
    headline,
    community: p.community ?? null,
    emirate: p.emirate ?? null,
    bedrooms: p.bedrooms ?? null,
    bathrooms: p.bathrooms ?? null,
    propertyType: p.propertyType ?? null,
    coverUrl: p.coverPublicPath ? publicPhotoUrl(p.coverPublicPath) : null,
  };
}

export interface TxRow {
  id: string;
  listingId: string;
  reference: string;
  status: TransactionStatus;
  nextActor: TransactionNextActor;
  buyerUserId: string;
  sellerUserId: string;
  acceptedAmountAed: string | number;
  purchaseRoute: string | null;
  financingStatus: string | null;
  depositAmountAed: string | number | null;
  depositConfirmedAt: Date | null;
  transferPreferredDate: string | null;
  transferAppointmentAt: Date | null;
  cancellationReason: string | null;
  cancellationRequestedBy: string | null;
  failureCategory: string | null;
  version: number;
  startedAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskRow {
  code: string;
  stage: TransactionStatus;
  sequence: number;
  assignedActor: TransactionActor;
  required: boolean;
  status: TransactionTaskStatus;
  completedAt: Date | null;
}

export interface EventRow {
  eventType: string;
  actor: TransactionActor | null;
  metadata: unknown;
  createdAt: Date;
}

export interface DocRow {
  id: string;
  uploadedBy: string;
  documentType: string;
  fileName: string;
  status: string;
  createdAt: Date;
}

function perspectiveOf(row: TxRow, userId: string): Perspective {
  return row.buyerUserId === userId ? 'BUYER' : 'SELLER';
}

function num(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  return typeof v === 'number' ? v : Number(v);
}

/** Compact card for the My Transactions dashboard (spec §16.2). */
export function toTransactionListItem(
  row: TxRow,
  userId: string,
  property: TxPropertyJson | null,
  tasks: TaskRow[],
) {
  const perspective = perspectiveOf(row, userId);
  const progress = computeProgress(
    tasks.map((t) => ({ code: t.code, status: t.status, required: t.required })),
  );
  return {
    id: row.id,
    reference: row.reference,
    status: row.status,
    statusKey: transactionStatusKey(row.status),
    nextActor: row.nextActor,
    nextActorKey: nextActorKey(row.nextActor, perspective),
    perspective,
    property: mapProperty(property),
    acceptedAmountAed: num(row.acceptedAmountAed),
    stageIndex: stageIndex(row.status),
    completedStages: completedStageCount(row.status),
    totalStages: TRANSACTION_STAGES.length,
    progress,
    lastActivityAt: row.updatedAt.toISOString(),
  };
}

/** Full perspective-aware workspace detail. Documents are participant-scoped. */
export function toTransactionDetail(args: {
  row: TxRow;
  userId: string;
  property: TxPropertyJson | null;
  tasks: TaskRow[];
  events: EventRow[];
  ownDocuments: DocRow[];
  otherDocuments: DocRow[];
}) {
  const { row, userId } = args;
  const perspective = perspectiveOf(row, userId);
  const base = toTransactionListItem(row, userId, args.property, args.tasks);

  // Other participant's private files are reduced to per-type completeness only.
  const otherChecklist: Record<string, 'COMPLETE' | 'INCOMPLETE'> = {};
  for (const d of args.otherDocuments) {
    if (d.status !== 'REMOVED') otherChecklist[d.documentType] = 'COMPLETE';
  }

  return {
    ...base,
    version: row.version,
    purchaseRoute: row.purchaseRoute,
    financingStatus: row.financingStatus,
    depositAmountAed: num(row.depositAmountAed),
    depositConfirmedAt: row.depositConfirmedAt?.toISOString() ?? null,
    transferPreferredDate: row.transferPreferredDate ?? null,
    transferAppointmentAt: row.transferAppointmentAt?.toISOString() ?? null,
    cancellation:
      row.status === 'CANCELLATION_PENDING' || row.status === 'CANCELLED'
        ? {
            reason: row.cancellationReason,
            requestedBySide:
              row.cancellationRequestedBy == null
                ? null
                : row.cancellationRequestedBy === row.buyerUserId
                  ? 'BUYER'
                  : 'SELLER',
            pending: row.status === 'CANCELLATION_PENDING',
          }
        : null,
    tasks: args.tasks
      .filter((t) => t.status !== 'SKIPPED')
      .map((t) => ({
        code: t.code,
        stage: t.stage,
        actor: t.assignedActor,
        status: t.status,
        required: t.required,
        mine:
          (perspective === 'BUYER' && t.assignedActor === 'BUYER') ||
          (perspective === 'SELLER' && t.assignedActor === 'SELLER'),
        ownershipKey: taskOwnershipKey(t.assignedActor, t.status, perspective),
      })),
    ownDocuments: args.ownDocuments
      .filter((d) => d.status !== 'REMOVED')
      .map((d) => ({
        id: d.id,
        documentType: d.documentType,
        fileName: d.fileName,
        status: d.status,
        createdAt: d.createdAt.toISOString(),
        isBuyerType: isBuyerDocumentType(d.documentType as never),
      })),
    otherChecklist,
    timeline: args.events.map((e) => ({
      type: e.eventType,
      actor: e.actor,
      createdAt: e.createdAt.toISOString(),
    })),
  };
}

export type TransactionListItem = ReturnType<typeof toTransactionListItem>;
export type TransactionDetail = ReturnType<typeof toTransactionDetail>;
