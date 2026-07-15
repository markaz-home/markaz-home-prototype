# Listing State Machine

Defined in `packages/domain/src/listing.ts`. See **ADR-0010** for the retry /
invalidation rationale.

## Canonical states

```
DRAFT → DETAILS_COMPLETE → DOCUMENT_UPLOADED → OWNERSHIP_REVIEW →
OWNERSHIP_VERIFIED → FORM_A_COMPLETE → PHOTOS_COMPLETE → PERMIT_PENDING →
READY_TO_PUBLISH                      (Week-2 milestone ends here)
LIVE · PAUSED · REJECTED · SOLD_DEMO (later milestones / Admin)
```

Listing **Settings**, **Investment Case**, and **Review** are derived sub-states /
completion requirements, **not** enum values.

## Transitions

- **Forward** (`canTransitionListing`, strict single-step adjacency) advances the
  milestone as each section completes.
- **Rewind** (`canRewindListing`, server-only) moves the listing backward along
  the linear chain when an invalidating edit occurs:
  - replace/remove the ownership document → `DOCUMENT_UPLOADED` / `DETAILS_COMPLETE`
    (verification superseded);
  - edit details/settings after Form A → `OWNERSHIP_VERIFIED` (Form A + permit
    superseded).
- **Failures do not transition** the listing. A failed simulated ownership check
  or permit sets the _record_ status `FAILED_DEMO`; the listing stays put and is
  recoverable (retry / replace). The customer never reaches `REJECTED`
  (reserved for a future Admin decision).

## Record freshness

`verifications` / `form_a_records` / `permit_records` carry `superseded_at`. The
active (non-superseded) record with the success status is the authoritative,
"fresh" one; `computeReadiness` (`listing-progress.ts`) uses these to gate
`READY_TO_PUBLISH`. The final transition requires permit approval, all required
sections complete, **and** customer confirmation on Review.

## Derived section statuses (drive the stepper + Review)

```
NOT_STARTED · IN_PROGRESS · COMPLETE · OPTIONAL_SKIPPED · PENDING · FAILED · REQUIRES_ATTENTION
```
