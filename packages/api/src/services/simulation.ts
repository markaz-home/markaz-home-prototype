import { and, desc, eq, isNull } from 'drizzle-orm';
import {
  listings,
  verifications,
  formARecords,
  permitRecords,
  ownershipDocuments,
  auditEvents,
  type Tx,
} from '@markaz/db';

/**
 * Simulated external services (design spec §14, §17, §19). These NEVER connect
 * to real government/registry/Trakheesi systems. Each: validates state, persists
 * a pending record, resolves to a controlled outcome, persists it, writes a safe
 * audit event, and is idempotent. Outcomes are deterministic and (in non-prod)
 * controllable via `demoOutcome` so failure/retry can be exercised in tests.
 */
export type DemoOutcome = 'SUCCESS' | 'FAILURE';

const isProd = () =>
  process.env.NODE_ENV === 'production' || process.env.DEMO_ENVIRONMENT === 'production';

/** Default SUCCESS; honour a forced outcome only outside production. */
export function resolveDemoOutcome(force?: DemoOutcome): DemoOutcome {
  if (!isProd() && force) return force;
  return 'SUCCESS';
}

async function audit(
  tx: Tx,
  actorId: string,
  action: string,
  entityId: string,
  metadata: Record<string, unknown> = {},
) {
  await tx
    .insert(auditEvents)
    .values({ actorId, action, entityType: 'listing', entityId, metadata });
}

export interface SimContext {
  tx: Tx;
  userId: string;
  listingId: string;
}

// --- Ownership verification (§14) -------------------------------------------
export const OwnershipVerificationService = {
  /** Start the simulated check: supersede prior attempts, create PENDING, advance to OWNERSHIP_REVIEW. */
  async start({ tx, userId, listingId }: SimContext, force?: DemoOutcome) {
    const decided = resolveDemoOutcome(force);
    await tx
      .update(verifications)
      .set({ supersededAt: new Date() })
      .where(
        and(
          eq(verifications.listingId, listingId),
          eq(verifications.kind, 'OWNERSHIP'),
          isNull(verifications.supersededAt),
        ),
      );
    await tx.insert(verifications).values({
      listingId,
      kind: 'OWNERSHIP',
      status: 'PENDING',
      result: { decided },
    });
    await tx.update(listings).set({ state: 'OWNERSHIP_REVIEW' }).where(eq(listings.id, listingId));
    await audit(tx, userId, 'OWNERSHIP_VERIFICATION_STARTED', listingId);
    return { status: 'PENDING' as const };
  },

  /** Resolve a PENDING check to its decided outcome (idempotent). */
  async resolve({ tx, userId, listingId }: SimContext) {
    const [rec] = await tx
      .select()
      .from(verifications)
      .where(
        and(
          eq(verifications.listingId, listingId),
          eq(verifications.kind, 'OWNERSHIP'),
          isNull(verifications.supersededAt),
        ),
      )
      .orderBy(desc(verifications.createdAt))
      .limit(1);
    if (!rec || rec.status !== 'PENDING') return rec ?? null;

    const decided = (rec.result as { decided?: DemoOutcome })?.decided ?? 'SUCCESS';
    if (decided === 'SUCCESS') {
      await tx
        .update(verifications)
        .set({ status: 'VERIFIED_DEMO' })
        .where(eq(verifications.id, rec.id));
      await tx
        .update(ownershipDocuments)
        .set({ status: 'VERIFIED_DEMO' })
        .where(
          and(eq(ownershipDocuments.listingId, listingId), eq(ownershipDocuments.active, true)),
        );
      await tx
        .update(listings)
        .set({ state: 'OWNERSHIP_VERIFIED' })
        .where(eq(listings.id, listingId));
      await audit(tx, userId, 'OWNERSHIP_VERIFICATION_SUCCEEDED', listingId);
    } else {
      await tx
        .update(verifications)
        .set({ status: 'FAILED_DEMO', failureReason: 'DEMO_MISMATCH' })
        .where(eq(verifications.id, rec.id));
      await audit(tx, userId, 'OWNERSHIP_VERIFICATION_FAILED', listingId, {
        reason: 'DEMO_MISMATCH',
      });
    }
    const [updated] = await tx
      .select()
      .from(verifications)
      .where(eq(verifications.id, rec.id))
      .limit(1);
    return updated ?? null;
  },
};

// --- Simulated Form A (§17) -------------------------------------------------
export const FormAService = {
  /** Record the demo confirmation and complete (or fail) the simulated Form A. */
  async complete(
    { tx, userId, listingId }: SimContext,
    listingPriceAed: number,
    force?: DemoOutcome,
  ) {
    const decided = resolveDemoOutcome(force);
    await tx
      .update(formARecords)
      .set({ supersededAt: new Date() })
      .where(and(eq(formARecords.listingId, listingId), isNull(formARecords.supersededAt)));
    if (decided === 'SUCCESS') {
      await tx.insert(formARecords).values({
        listingId,
        status: 'VERIFIED_DEMO',
        confirmedBy: userId,
        listingPriceAtConfirmation: String(listingPriceAed),
        signedAt: new Date(),
      });
      await tx.update(listings).set({ state: 'FORM_A_COMPLETE' }).where(eq(listings.id, listingId));
      await audit(tx, userId, 'FORM_A_SIMULATION_COMPLETED', listingId);
      return { status: 'COMPLETE' as const };
    }
    await tx.insert(formARecords).values({ listingId, status: 'FAILED_DEMO' });
    await audit(tx, userId, 'FORM_A_SIMULATION_FAILED', listingId);
    return { status: 'FAILED' as const };
  },
};

// --- Simulated Trakheesi permit (§19) ---------------------------------------
export const PermitService = {
  /** Submit the demo permit application: supersede prior, create PENDING, advance to PERMIT_PENDING. */
  async submit({ tx, userId, listingId }: SimContext, force?: DemoOutcome) {
    const decided = resolveDemoOutcome(force);
    await tx
      .update(permitRecords)
      .set({ supersededAt: new Date() })
      .where(and(eq(permitRecords.listingId, listingId), isNull(permitRecords.supersededAt)));
    await tx.insert(permitRecords).values({
      listingId,
      permitType: 'TRAKHEESI',
      status: 'PENDING',
      failureReason: decided === 'FAILURE' ? 'PENDING_FAIL' : null,
    });
    await tx.update(listings).set({ state: 'PERMIT_PENDING' }).where(eq(listings.id, listingId));
    await audit(tx, userId, 'PERMIT_SIMULATION_SUBMITTED', listingId);
    return { status: 'PENDING' as const };
  },

  /** Resolve a PENDING permit to APPROVED/FAILED (idempotent). Listing stays PERMIT_PENDING. */
  async resolve({ tx, userId, listingId }: SimContext) {
    const [rec] = await tx
      .select()
      .from(permitRecords)
      .where(and(eq(permitRecords.listingId, listingId), isNull(permitRecords.supersededAt)))
      .orderBy(desc(permitRecords.createdAt))
      .limit(1);
    if (!rec || rec.status !== 'PENDING') return rec ?? null;

    if (rec.failureReason === 'PENDING_FAIL') {
      await tx
        .update(permitRecords)
        .set({ status: 'FAILED_DEMO', failureReason: 'DEMO_SERVICE_UNAVAILABLE' })
        .where(eq(permitRecords.id, rec.id));
      await audit(tx, userId, 'PERMIT_SIMULATION_FAILED', listingId, {
        reason: 'DEMO_SERVICE_UNAVAILABLE',
      });
    } else {
      const permitNumber = `DEMO-TRK-${listingId.slice(0, 8).toUpperCase()}`;
      await tx
        .update(permitRecords)
        .set({ status: 'VERIFIED_DEMO', approvedAt: new Date(), permitNumber, failureReason: null })
        .where(eq(permitRecords.id, rec.id));
      await audit(tx, userId, 'PERMIT_SIMULATION_APPROVED', listingId);
    }
    const [updated] = await tx
      .select()
      .from(permitRecords)
      .where(eq(permitRecords.id, rec.id))
      .limit(1);
    return updated ?? null;
  },
};
