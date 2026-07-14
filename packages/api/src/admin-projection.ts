/**
 * Week-6 Admin DTO projections — explicit allow-list mapping (admin-portal-design-spec §35).
 * Even Admin responses avoid passwords, tokens, service secrets, raw Storage paths, signed
 * URLs (except the dedicated access procedure), and unnecessary identity. Raw enum values are
 * mapped to i18n keys client-side; no raw DB UUIDs appear in visible copy.
 */

// ---- Customers -------------------------------------------------------------
export interface AdminCustomerRow {
  id: string;
  fullName: string | null;
  email: string;
  restricted: boolean;
  onboarded: boolean;
  identityStatus: string;
  createdAt: Date;
  updatedAt: Date;
  listingCount: number;
  activeOfferCount: number;
  activeTransactionCount: number;
}

/** Partially mask an email for list views (spec §13.1) — never expose phone/identity numbers. */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain || !local) return '•••';
  const head = local.slice(0, Math.min(2, local.length));
  return `${head}${'•'.repeat(Math.max(1, local.length - 2))}@${domain}`;
}

export function toAdminCustomerListItem(r: AdminCustomerRow) {
  return {
    id: r.id,
    displayName: r.fullName ?? maskEmail(r.email),
    emailMasked: maskEmail(r.email),
    status: r.restricted ? ('ACTIONS_RESTRICTED' as const) : ('ACTIVE' as const),
    statusKey: r.restricted ? 'customers.status.restricted' : 'customers.status.active',
    onboarded: r.onboarded,
    identityStatus: r.identityStatus,
    listingCount: r.listingCount,
    activeOfferCount: r.activeOfferCount,
    activeTransactionCount: r.activeTransactionCount,
    createdAt: r.createdAt.toISOString(),
    lastActivityAt: r.updatedAt.toISOString(),
    attention: r.restricted && r.activeTransactionCount > 0,
  };
}

export interface AdminCustomerDetailInput extends AdminCustomerRow {
  restrictionReason: string | null;
  restrictedAt: Date | null;
}
export function toAdminCustomerDetail(r: AdminCustomerDetailInput) {
  return {
    ...toAdminCustomerListItem(r),
    // The internal restriction reason is operational metadata — shown to admins only.
    restrictionReason: r.restricted ? r.restrictionReason : null,
    restrictedAt: r.restrictedAt?.toISOString() ?? null,
  };
}

// ---- Audit -----------------------------------------------------------------
const SAFE_META_KEYS = new Set(['reason', 'category', 'previous', 'result', 'action', 'code', 'documentType', 'route', 'declined', 'kind', 'listingId', 'side']);

export interface AuditRow {
  id: string;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: unknown;
  createdAt: Date;
}
/** Allow-list audit metadata — never tokens, paths, signed URLs, raw errors (spec §30, §42.1). */
export function toAuditEvent(r: AuditRow) {
  const meta = (r.metadata && typeof r.metadata === 'object' ? (r.metadata as Record<string, unknown>) : {});
  const safe: Record<string, unknown> = {};
  for (const k of Object.keys(meta)) if (SAFE_META_KEYS.has(k)) safe[k] = meta[k];
  return {
    id: r.id,
    action: r.action,
    actorType: r.actorId ? (r.action.startsWith('ADMIN_') ? ('ADMIN' as const) : ('CUSTOMER' as const)) : ('SYSTEM' as const),
    entityType: r.entityType,
    entityId: r.entityId,
    metadata: safe,
    createdAt: r.createdAt.toISOString(),
  };
}

// ---- Admin notes -----------------------------------------------------------
export interface AdminNoteRow {
  id: string;
  category: string;
  body: string;
  followUpDate: string | null;
  createdByAdminId: string | null;
  supersedesNoteId: string | null;
  createdAt: Date;
}
export function toAdminNote(r: AdminNoteRow) {
  return {
    id: r.id,
    category: r.category,
    body: r.body,
    followUpDate: r.followUpDate,
    supersedesNoteId: r.supersedesNoteId,
    createdAt: r.createdAt.toISOString(),
  };
}

// ---- Document metadata (spec §23.1) — never the raw object path ------------
export interface AdminDocumentRow {
  id: string;
  documentType: string;
  uploadedBy: string | null;
  status: string;
  mimeType: string | null;
  sizeBytes: number | null;
  fileName: string | null;
  visibility: 'PRIVATE_TO_UPLOADER' | 'SHARED_WITH_PARTICIPANTS' | 'ADMIN_ONLY_FUTURE';
  createdAt: Date;
}
export function toAdminDocumentMetadata(r: AdminDocumentRow) {
  return {
    id: r.id,
    documentType: r.documentType,
    status: r.status,
    mimeType: r.mimeType,
    sizeBytes: r.sizeBytes,
    fileName: r.fileName,
    visibility: r.visibility,
    createdAt: r.createdAt.toISOString(),
  };
}
