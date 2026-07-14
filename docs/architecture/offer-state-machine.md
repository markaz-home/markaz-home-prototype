# Offer state machine (Week 4)

## Thread states (`offer_thread_status`)

| State | Meaning | next_actor |
|---|---|---|
| `DRAFT` | transient, during creation only | BUYER |
| `AWAITING_SELLER` | current proposal was submitted by the buyer | SELLER |
| `AWAITING_BUYER` | current proposal was submitted by the seller | BUYER |
| `ACCEPTED` | current proposal accepted | NONE |
| `REJECTED` | seller or buyer rejected | NONE |
| `WITHDRAWN` | buyer withdrew | NONE |
| `EXPIRED` | current proposal expired (server time) | NONE |
| `CLOSED_OTHER_ACCEPTED` | another thread on the listing was accepted | NONE |
| `CLOSED_LISTING_UNAVAILABLE` | listing paused / materially changed | NONE |

## Proposal states (`offer_proposal_status`)

`CURRENT` → `SUPERSEDED` (a newer counter) / `ACCEPTED` / `REJECTED` / `EXPIRED` /
`WITHDRAWN` / `CLOSED`. Proposals are immutable apart from this status field (guard
trigger blocks amount/creator/side/thread changes; `ACCEPTED` is reachable only via the
acceptance function).

## Transitions

```
create_offer:       (none) → AWAITING_SELLER          [buyer proposal CURRENT]
submit_counter:     AWAITING_SELLER → AWAITING_BUYER   [seller counter; prior SUPERSEDED]
                    AWAITING_BUYER  → AWAITING_SELLER   [buyer counter;  prior SUPERSEDED]
accept_offer:       AWAITING_*      → ACCEPTED          [+ close other active → CLOSED_OTHER_ACCEPTED]
reject_offer:       AWAITING_*      → REJECTED
withdraw_offer:     AWAITING_*      → WITHDRAWN          [buyer only]
expire_due_offers:  AWAITING_*      → EXPIRED            [current proposal past expires_at]
close_listing_offers: AWAITING_*    → CLOSED_LISTING_UNAVAILABLE [pause / material edit]
```

Each transition is server-authoritative: it re-validates membership, turn (`next_actor`),
`version` (optimistic concurrency), listing availability + version/publication-version
snapshot (`assert_offer_actionable`), and proposal expiry. A stale or out-of-turn action
fails with `STALE` / `NOT_YOUR_TURN` / `NOT_ACTIONABLE`.

## Derived availability (`OfferAvailability`)

Not a listing publication state (ADR-0016). Computed by `resolveAvailability`:
`LIVE` + no accepted offer → `AVAILABLE`; `LIVE` + accepted offer → `UNDER_OFFER`;
non-`LIVE` → `OFFERS_DISABLED`.

## User-facing copy

`userFacingStatusKey(status, perspective)` maps internal states to `offers.status.*` keys;
the buyer and seller see different copy for the same state (e.g. `AWAITING_SELLER` →
buyer "Waiting for seller" / seller "Your response is needed"). Raw enum values never
reach the UI (spec §3.17).

Pure implementations + unit tests: `packages/domain/src/offer.ts` (+ `__tests__/offer.test.ts`).
