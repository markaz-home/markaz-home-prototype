# Property Listing Journey (Week 2)

The customer listing-creation pipeline from `DRAFT` to `READY_TO_PUBLISH`. The
listing never becomes `LIVE` in this milestone. UX is governed by
`docs/design/property-listing-design-spec.md`.

## Layers

- **Domain** (`packages/domain`): `listing.ts` (state machine + `canRewindListing`),
  `listing-progress.ts` (section statuses, `computeReadiness`, `resolveNextStep`),
  `investment.ts` (calculations), `listing-validation.ts` (zod schemas + enums).
  Pure and fully unit-tested.
- **DB** (`packages/db` + `supabase/migrations/20260301000700_listing_journey.sql`):
  `properties`, `listings`, `ownership_documents`, `verifications`,
  `form_a_records`, `permit_records`, `property_photos`, `investment_cases`. See
  `listing-state-machine.md` and `listing-storage.md`.
- **API** (`packages/api`): `routers/listing.ts` (one nested router) +
  `services/simulation.ts` (the three mock services). Every mutation:
  `customerProcedure` → ownership check (RLS `ctx.tx`) → zod → valid-state check →
  audit → safe typed error. Server recomputes trusted values (readiness, investment).
- **Web** (`apps/web`): `/[locale]/sell/*` routes, `components/sell/*` (wizard
  shell, My Listings, step screens), `lib/listing-storage.ts` (signed URLs).

## Routes & resumption

Explicit per-step routes (design spec §6.1). `/sell/new` preflights for a recent
empty draft; `/sell/listings/[id]` resolves the authoritative state and redirects
to `resolveNextStep`. Each step refetches `listing.get` (`staleTime: 0`) so it
reflects the latest server state after mutations/simulations. Completed steps are
revisitable; future steps are locked until prerequisites are met. Ownership is
enforced server-side; a non-owner sees a safe "not available" panel.

## Readiness (server-authoritative)

`computeReadiness` derives `READY_TO_PUBLISH` eligibility from a normalised
snapshot (required sections complete + record freshness). `review.markReady`
re-checks readiness server-side before transitioning. Investment Case is optional
and excluded from the gate.

## Simulations

`OwnershipVerificationService` / `FormAService` / `PermitService` validate state,
persist a PENDING record, resolve to a controlled outcome (default SUCCESS; a
non-production `demoOutcome` forces FAILURE for tests), persist the result, write a
safe audit event, and are idempotent. They never claim official results.

## Tests

Domain unit (`packages/domain/src/__tests__/listing-journey.test.ts`); backend
integration through the real router (`tests/integration/listing-journey.test.ts`);
draft/ready privacy (`tests/integration/listing-privacy.test.ts`); browser
end-to-end (`apps/web/e2e/listing-journey.spec.ts`).
