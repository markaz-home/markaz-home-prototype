# Offers architecture (Week 4)

A private, structured, **non-binding** negotiation between two `CUSTOMER`s over a `LIVE`
listing. Buyer and Seller are journeys of one account. Governed by
`docs/design/offers-design-spec.md`.

## Model

```
offer_threads (1 per buyer+listing)
├── listing_id, buyer_user_id, seller_user_id      -- immutable identity
├── status, next_actor                              -- AWAITING_SELLER / AWAITING_BUYER / …
├── current_proposal_id → offer_proposals           -- the one actionable proposal
├── accepted_proposal_id → offer_proposals          -- set only on acceptance
├── expires_at, listing_version, publication_version -- snapshots (staleness)
├── version                                         -- optimistic concurrency
└── buyer_seq                                       -- stable "Buyer NN" label

offer_proposals (immutable; insert-only)
├── thread_id, created_by_user_id, created_by_side  -- side is SERVER-derived
├── amount_aed numeric(14,2), status                -- CURRENT/SUPERSEDED/ACCEPTED/…
└── expires_at, created_at

offer_events (participant-readable timeline)
└── thread_id, event_type, actor_side, amount_aed, created_at
```

Reuses `notifications` (in-app, recipient-only RLS) and `audit_events` (private). No
parallel notification/offer systems (ADR-0014).

## Write path

Customers have **read-only** RLS on the offer tables. Every mutation goes through a
`SECURITY DEFINER` SQL function (owned by a BYPASSRLS role; mirrors the Week-1
`enforce_offer_not_on_own_listing`/`is_admin` pattern):

| Function                                           | Effect                                                  |
| -------------------------------------------------- | ------------------------------------------------------- |
| `create_offer(listing, amount, expires)`           | New thread + initial buyer proposal (`AWAITING_SELLER`) |
| `submit_counter(thread, amount, expires, version)` | Supersede current, new proposal, flip `next_actor`      |
| `accept_offer(thread, proposal, version)`          | Atomic accept + close other threads (see acceptance)    |
| `reject_offer(thread, version, reason)`            | Terminal; seller reason is private                      |
| `withdraw_offer(thread, version)`                  | Buyer-only; terminal                                    |
| `close_listing_offers(listing, reason)`            | Pause/material-edit closes active threads               |
| `expire_due_offers()`                              | Lazy expiry on read (no durable job dependency)         |
| `mark_offer_viewed(thread)`                        | Optional seller-viewed event                            |
| `offer_listing_summary(listing)`                   | Public-safe property summary for a participant/owner    |

These resolve the actor from `auth.uid()` (never client-supplied) and derive
`created_by_side` from thread membership.

## API

`packages/api/src/routers/offers.ts` (tRPC, `customerProcedure`): buyer
(`eligibility`, `submitInitialProposal`, `getBuyerThreads`, `submitBuyerCounter`,
`acceptSellerCounter`, `rejectSellerCounter`, `withdraw`), seller (`getSellerInbox`,
`getListingOffers`, `submitSellerCounter`, `acceptBuyerProposal`, `reject`), shared
(`getThread`, `getUnreadCounts`, `notifications`, `markNotificationRead`). Errors carry a
stable machine token mapped to localized copy; missing and forbidden both surface as the
unified "This offer is not available".

DTOs are built by **explicit allow-list** (`packages/api/src/offer-projection.ts`): the
buyer view never carries the threshold, the seller-private rejection reason, or competing
offers; the seller view adds the buyer-safe `Buyer NN` label + threshold classification.

## UI

Routes under `(public)/properties/[publicId]/[slug]/offer`, `(app)/offers`,
`(app)/offers/[offerThreadId]`, `(app)/sell/listings/[listingId]/offers`. Components in
`apps/web/src/components/offers/*`. Anonymous interception reuses the save-intent pattern
(`lib/offer-intent.ts` + `OfferIntentRedirect`). AED stays LTR via `lib/format.ts`; all
copy via `next-intl` (`offers` namespace).
